package ru.dndshare.client.maps.rendering

import android.os.Handler
import android.os.Looper
import android.view.Choreographer
import android.view.Surface
import com.google.android.filament.*
import com.google.android.filament.gltfio.*
import com.google.android.filament.utils.Utils
import java.nio.ByteBuffer
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.maps.*

/** The renderer looper owns every Filament object; IO never runs on this looper. */
internal class FilamentSceneCore(
    private val cache: MapAssetCache,
    dispatcher: CoroutineDispatcher,
    private val status: (Int, String?) -> Unit,
) : AutoCloseable {
    private val scope = CoroutineScope(SupervisorJob() + dispatcher)
    val engine: Engine
    private val view: com.google.android.filament.View
    private val scene: Scene
    private val renderer: Renderer
    private val camera: Camera
    private val materials: UbershaderProvider
    private val loader: AssetLoader
    private val resources: ResourceLoader
    private val groundResources: ResourceLoader
    private var swap: SwapChain? = null
    private var closed = false
    private var active = true
    private var scheduled = false
    private var pendingPicks = 0
    private var pose = MapCamera()
    private var document: JsonObject? = null
    private val models = mutableMapOf<String, MapModel>()
    private var entries = emptyList<MapSceneEntry>()
    private val pools = mutableMapOf<String, MapModelPool>()
    private val pending = mutableSetOf<String>()
    private val failed = mutableSetOf<String>()
    private val slots = Semaphore(3)
    private val downloaded = ArrayDeque<DownloadedModel>()
    private var loading: MapModelPool? = null
    private var ground: FilamentAsset? = null
    private var groundKey = ""
    private val entities = mutableMapOf<Int, String>()
    private val lights: MapSceneLights
    private val choreographer = Choreographer.getInstance()
    private val callback = Choreographer.FrameCallback { frame(it) }
    val width
        get() = view.viewport.width

    val height
        get() = view.viewport.height

    @Volatile
    var renderedFrames = 0L
        private set

    @Volatile
    var hasMapFrame = false
        private set

    val readyModelUrls
        get() = pools.filterValues { it.ready }.keys.toSet()

    init {
        Utils.init()
        Gltfio.init()
        engine = Engine.create(Engine.Backend.OPENGL)
        engine.setAutomaticInstancingEnabled(true)
        renderer = engine.createRenderer()
        scene = engine.createScene()
        camera = engine.createCamera(EntityManager.get().create())
        camera.setExposure(16f, 1f / 125f, 100f)
        view =
            engine.createView().apply {
                this.scene = this@FilamentSceneCore.scene
                this.camera = this@FilamentSceneCore.camera
                antiAliasing = com.google.android.filament.View.AntiAliasing.FXAA
            }
        renderer.clearOptions =
            Renderer.ClearOptions().apply {
                clear = true
                clearColor = doubleArrayOf(.0086, .0086, .0116, 1.0)
            }
        materials = UbershaderProvider(engine)
        loader = AssetLoader(engine, materials, EntityManager.get())
        resources = ResourceLoader(engine, true)
        groundResources = ResourceLoader(engine, true)
        lights = MapSceneLights(engine, scene)
    }

    fun surface(surface: Surface) {
        swap?.let(engine::destroySwapChain)
        swap = engine.createSwapChain(surface)
        requestFrame()
    }

    fun detach() {
        swap?.let {
            engine.destroySwapChain(it)
            engine.flushAndWait()
        }
        swap = null
    }

    fun resize(width: Int, height: Int) {
        view.viewport = Viewport(0, 0, width, height)
        updateCamera()
        requestFrame()
    }

    fun camera(value: MapCamera) {
        pose = value
        updateCamera()
        requestFrame()
    }

    private fun updateCamera() {
        if (width == 0 || height == 0) return
        val halfWidth = width / 2.0 / pose.pixels
        val halfHeight = height / 2.0 / pose.pixels
        camera.setProjection(
            Camera.Projection.ORTHO,
            -halfWidth,
            halfWidth,
            -halfHeight,
            halfHeight,
            .01,
            2000.0,
        )
        val eye = pose.eye
        camera.lookAt(
            eye[0],
            eye[1],
            eye[2],
            pose.x,
            pose.elevation,
            pose.y,
            -kotlin.math.sin(Math.toRadians(pose.azimuth)),
            0.0,
            -kotlin.math.cos(Math.toRadians(pose.azimuth)),
        )
    }

    fun update(value: JsonObject, catalogue: List<MapModel>) {
        if (closed) return
        document = value
        models.clear()
        models.putAll(catalogue.associateBy { it.uuid })
        entries = mapSceneEntries(value, models)
        val wanted = entries.groupBy { it.model.renderUrl }
        pools.keys.filter { it !in wanted }.forEach(::removePool)
        for ((url, group) in wanted) {
            val pool = pools[url]
            if (pool != null && pool.capacity < group.size && loading !== pool) removePool(url)
            if (url !in pools && url !in pending && url !in failed) download(url)
        }
        val w = value.number("width").toInt()
        val h = value.number("height").toInt()
        val grid = (value["grid"] as? JsonObject)?.flag("visible") ?: true
        val key = "$w:$h:$grid"
        if (groundKey != key) {
            ground?.let {
                scene.removeEntities(it.entities)
                loader.destroyAsset(it)
            }
            ground =
                loader.createAsset(mapGroundGlb(w, h, grid))?.also {
                    groundResources.loadResources(it)
                    scene.addEntities(it.entities)
                    it.releaseSourceData()
                }
            groundKey = key
        }
        lights.update(value, entries)
        synchronize()
        requestFrame()
    }

    private fun download(url: String) {
        pending += url
        status(pending.size, null)
        scope.launch {
            try {
                slots.withPermit {
                    val bytes = cache.bytes(url)
                    val consumed = CompletableDeferred<Unit>()
                    downloaded.addLast(DownloadedModel(url, bytes, consumed))
                    requestFrame()
                    consumed.await()
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                pending -= url
                failed += url
                status(pending.size, error.message)
            }
        }
    }

    private fun loadNext() {
        if (loading != null || downloaded.isEmpty()) return
        val source = downloaded.removeFirst()
        val url = source.url
        val count = entries.count { it.model.renderUrl == url }
        if (count == 0) {
            pending -= url
            source.consumed.complete(Unit)
            status(pending.size, null)
            return
        }
        try {
            val instances =
                arrayOfNulls<FilamentInstance>(maxOf(8, Integer.highestOneBit(count - 1) * 2))
            val asset =
                requireNotNull(
                    loader.createInstancedAsset(ByteBuffer.wrap(source.bytes), instances)
                ) {
                    "Не удалось открыть GLB-модель"
                }
            val pool = MapModelPool(url, asset, instances.map { requireNotNull(it) })
            pools[url] = pool
            loading = pool
            check(resources.asyncBeginLoad(asset)) { "Не удалось загрузить материалы модели" }
            asset.releaseSourceData()
        } catch (error: Exception) {
            pools.remove(url)?.let { loader.destroyAsset(it.asset) }
            loading = null
            pending -= url
            failed += url
            status(pending.size, error.message)
        } finally {
            source.consumed.complete(Unit)
        }
    }

    private fun synchronize() {
        entities.clear()
        for ((url, pool) in pools) {
            if (!pool.ready) continue
            val wanted = entries.filter { it.model.renderUrl == url }
            val ids = wanted.map { it.id }.toSet()
            pool.assigned.keys
                .filter { it !in ids }
                .forEach { id ->
                    pool.assigned.remove(id)?.let { scene.removeEntities(it.entities) }
                }
            val used = pool.assigned.values.toSet()
            val available = ArrayDeque(pool.instances.filter { it !in used })
            for (entry in wanted) {
                val instance =
                    pool.assigned[entry.id]
                        ?: available.removeFirstOrNull()?.also {
                            pool.assigned[entry.id] = it
                            scene.addEntities(it.entities)
                        }
                        ?: continue
                val manager = engine.transformManager
                manager.setTransform(manager.getInstance(instance.root), entry.matrix)
                instance.entities.forEach { entities[it] = entry.id }
            }
        }
    }

    fun pick(x: Float, y: Float, result: (String?) -> Unit) {
        if (closed || width == 0 || height == 0) return
        val mapping = entities.toMap()
        pendingPicks++
        view.pick(x.toInt(), height - y.toInt() - 1, Handler(requireNotNull(Looper.myLooper()))) {
            pendingPicks--
            if (!closed) Handler(Looper.getMainLooper()).post { result(mapping[it.renderable]) }
        }
        requestFrame()
    }

    fun retry() {
        failed.clear()
        document?.let { update(it, models.values.toList()) }
    }

    fun foreground(value: Boolean) {
        active = value
        if (value) requestFrame()
        else {
            choreographer.removeFrameCallback(callback)
            scheduled = false
        }
    }

    fun requestFrame() {
        if (!closed && active && !scheduled) {
            scheduled = true
            choreographer.postFrameCallback(callback)
        }
    }

    private fun frame(time: Long) {
        scheduled = false
        if (closed || !active) return
        loadNext()
        loading?.let { pool ->
            resources.asyncUpdateLoad()
            if (resources.asyncGetLoadProgress() >= 1f) {
                pool.ready = true
                loading = null
                pending -= pool.url
                status(pending.size, null)
                synchronize()
            }
        }
        val chain = swap
        if (width > 0 && height > 0 && chain != null && renderer.beginFrame(chain, time)) {
            renderer.render(view)
            renderer.endFrame()
            renderedFrames++
            if (!hasMapFrame && document != null && ground != null) {
                engine.flushAndWait()
                hasMapFrame = true
                status(pending.size, null)
            }
        }
        if (loading != null || downloaded.isNotEmpty() || pendingPicks > 0) requestFrame()
    }

    private fun removePool(url: String) {
        pending -= url
        pools.remove(url)?.let { pool ->
            if (loading === pool) {
                resources.asyncCancelLoad()
                loading = null
            }
            pool.instances.forEach { scene.removeEntities(it.entities) }
            loader.destroyAsset(pool.asset)
        }
    }

    override fun close() {
        if (closed) return
        closed = true
        scope.cancel()
        choreographer.removeFrameCallback(callback)
        detach()
        resources.asyncCancelLoad()
        pools.keys.toList().forEach(::removePool)
        ground?.let { loader.destroyAsset(it) }
        lights.close()
        resources.destroy()
        groundResources.destroy()
        loader.destroy()
        materials.destroyMaterials()
        materials.destroy()
        engine.destroyCameraComponent(camera.entity)
        EntityManager.get().destroy(camera.entity)
        engine.destroyView(view)
        engine.destroyScene(scene)
        engine.destroyRenderer(renderer)
        engine.destroy()
    }
}

private class MapModelPool(
    val url: String,
    val asset: FilamentAsset,
    val instances: List<FilamentInstance>,
) {
    val capacity
        get() = instances.size

    val assigned = mutableMapOf<String, FilamentInstance>()
    var ready = false
}

private class DownloadedModel(
    val url: String,
    val bytes: ByteArray,
    val consumed: CompletableDeferred<Unit>,
)
