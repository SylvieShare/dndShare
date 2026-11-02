package ru.dndshare.client.maps.rendering

import android.animation.ValueAnimator
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.Choreographer
import android.view.Surface
import com.google.android.filament.*
import com.google.android.filament.gltfio.*
import com.google.android.filament.utils.Utils
import kotlinx.coroutines.*
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.geometry.*

/** The renderer looper owns every Filament object; IO never runs on this looper. */
internal class FilamentSceneCore(
    context: Context,
    private val cache: MapAssetCache,
    dispatcher: CoroutineDispatcher,
    private val status: (Int, String?) -> Unit,
) : AutoCloseable {
    private val scope = CoroutineScope(SupervisorJob() + dispatcher)
    val engine: Engine
    private val view: com.google.android.filament.View
    private val scene: Scene
    private val background: Skybox
    private val renderer: Renderer
    private val camera: Camera
    private var swap: SwapChain? = null
    private var closed = false
    private var active = true
    private var scheduled = false
    private var delayed = false
    private var pendingPicks = 0
    private var pose = MapCamera()
    private var options = MapSceneOptions()
    private var document: JsonObject? = null
    private val models = mutableMapOf<String, MapModel>()
    private var entries = emptyList<MapSceneEntry>()
    private val assets: MapSceneAssets
    private val effects: MapSceneEffects
    private val captures = MapFrameCapture()
    private val lights: MapSceneLights
    private val choreographer = Choreographer.getInstance()
    private val callback = Choreographer.FrameCallback {
        try {
            frame(it)
        } catch (error: Exception) {
            scheduled = false
            captures.fail(error)
            status(assets.pendingCount, error.message)
        }
    }
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

    @Volatile
    var effectStatistics = MapEffectStatistics()
        private set

    val readyModelUrls
        get() =
            models.values
                .filter { activeUrl(it) in assets.readyModelUrls }
                .flatMap { listOf(it.renderUrl, it.lodUrl).filter(String::isNotBlank) }
                .toSet()

    private fun activeUrl(model: MapModel) =
        if (options.forceLod) model.lodUrl.ifBlank { model.renderUrl } else model.renderUrl

    fun options(value: MapSceneOptions) {
        val reload = options.forceLod != value.forceLod
        options = value
        if (reload) document?.let { update(it, models.values.toList()) }
        requestFrame()
    }

    fun snapshot(result: (Result<android.graphics.Bitmap>) -> Unit) {
        if (!active || swap == null || width <= 0 || height <= 0) {
            Handler(Looper.getMainLooper()).post {
                result(Result.failure(IllegalStateException("Карта ещё не готова")))
            }
            return
        }
        captures.request(result)
        requestFrame()
    }

    init {
        Utils.init()
        Gltfio.init()
        engine = Engine.create(Engine.Backend.OPENGL)
        engine.setAutomaticInstancingEnabled(true)
        renderer = engine.createRenderer()
        scene = engine.createScene()
        background = Skybox.Builder().color(.0086f, .0086f, .0116f, 1f).build(engine)
        scene.skybox = background
        camera = engine.createCamera(EntityManager.get().create())
        camera.setExposure(1f)
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
        assets = MapSceneAssets(engine, scene, cache, scope, ::requestFrame, status)
        lights = MapSceneLights(engine, scene)
        effects =
            MapSceneEffects(context, engine, scene, cache, scope, ::requestFrame) { error ->
                status(assets.pendingCount, error)
            }
    }

    fun surface(surface: Surface) {
        swap?.let(engine::destroySwapChain)
        swap = engine.createSwapChain(surface, SwapChainFlags.CONFIG_READABLE)
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
        entries =
            mapSceneEntries(value, models).map {
                it.copy(model = it.model.copy(renderUrl = activeUrl(it.model)))
            }
        assets.update(value, entries)
        val context = MapContext(value, catalogue)
        lights.update(context)
        effects.update(context, entries)
        requestFrame()
    }

    private fun pickTarget(x: Float, y: Float, result: (Pair<String, String>?) -> Unit) {
        if (closed || width == 0 || height == 0) {
            result(null)
            return
        }
        val mapping = assets.entities.mapValues { it.value to "model" } + effects.picks
        pendingPicks++
        view.pick(
            x.toInt().coerceIn(0, width - 1),
            (height - y.toInt() - 1).coerceIn(0, height - 1),
            Handler(requireNotNull(Looper.myLooper())),
        ) {
            pendingPicks--
            if (!closed) result(mapping[it.renderable])
        }
        requestFrame()
    }

    fun pick(x: Float, y: Float, result: (String?) -> Unit) {
        pickTarget(x, y) { hit ->
            Handler(Looper.getMainLooper()).post { if (!closed) result(hit?.first) }
        }
    }

    fun pickSurface(x: Float, y: Float, result: (MapSurfaceHit?) -> Unit) {
        val snapshot = entries.associateBy { it.id }
        val doc = document
        val clip =
            Mat4.multiply(
                camera.getModelMatrix(null).map(Double::toFloat).toFloatArray(),
                Mat4.inverse(camera.getProjectionMatrix(null).map(Double::toFloat).toFloatArray()),
            )
        val nx = (x.toInt() + .5f) / width.coerceAtLeast(1) * 2 - 1
        val ny = 1 - (y.toInt() + .5f) / height.coerceAtLeast(1) * 2
        val origin = Mat4.point(clip, Vec3(nx, ny, -1f))
        val far = Mat4.point(clip, Vec3(nx, ny, 1f))
        pickTarget(x, y) { target ->
            val id = target?.first
            val ownerId =
                if (target?.second == "decal")
                    (doc?.rows("decals")?.find { it.string("id") == id }?.get("anchor")
                            as? JsonObject)
                        ?.string("id")
                else id
            val entry = snapshot[ownerId]
            if (entry == null) Handler(Looper.getMainLooper()).post { if (!closed) result(null) }
            else
                scope.launch {
                    try {
                        val (_, geometry) = cache.geometry(entry.model.renderUrl)
                        val hit =
                            withContext(Dispatchers.Default) {
                                val inverse = Mat4.inverse(entry.matrix)
                                val localOrigin = Mat4.point(inverse, origin)
                                mapSurfaceIntersection(
                                    geometry,
                                    localOrigin,
                                    (Mat4.point(inverse, far) - localOrigin).normalized(),
                                )
                            }
                        val found = hit?.let {
                            MapSurfaceHit(
                                requireNotNull(id),
                                if (target?.second == "decal") "decal"
                                else if (entry.model.isObject) "object" else "tile",
                                entry.model.uuid,
                                Mat4.point(entry.matrix, it.position),
                                it.position,
                                it.normal,
                            )
                        }
                        Handler(Looper.getMainLooper()).post { if (!closed) result(found) }
                    } catch (cancelled: CancellationException) {
                        throw cancelled
                    } catch (error: Exception) {
                        status(assets.pendingCount, error.message)
                        Handler(Looper.getMainLooper()).post { if (!closed) result(null) }
                    }
                }
        }
    }

    fun retry() {
        assets.retry()
        effects.retry()
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
        if (scheduled && delayed && active && !closed) {
            choreographer.removeFrameCallback(callback)
            scheduled = false
            delayed = false
        }
        if (!closed && active && !scheduled) {
            scheduled = true
            choreographer.postFrameCallback(callback)
        }
    }

    private fun frame(time: Long) {
        scheduled = false
        delayed = false
        if (closed || !active) return
        assets.advance()
        val seconds = time / 1_000_000_000.0
        val motion = options.animate && ValueAnimator.areAnimatorsEnabled()
        val effectMotion = effects.advance(seconds, motion)
        val lightMotion = lights.advance(seconds, motion)
        val postProcess = effects.prepare(view, camera, seconds, motion)
        effectStatistics = effects.statistics
        val chain = swap
        if (width > 0 && height > 0 && chain != null) {
            if (!renderer.beginFrame(chain, time)) {
                requestFrame()
                return
            }
            try {
                if (postProcess) effects.render(renderer, view) else renderer.render(view)
                captures.render(renderer, width, height)
            } finally {
                renderer.endFrame()
            }
            renderedFrames++
            if (!hasMapFrame && document != null && assets.hasGround) {
                engine.flushAndWait()
                hasMapFrame = true
                status(assets.pendingCount, null)
            }
        }
        if (assets.working || pendingPicks > 0 || captures.working) requestFrame()
        else if ((effectMotion || lightMotion) && !scheduled) {
            scheduled = true
            delayed = true
            choreographer.postFrameCallbackDelayed(
                callback,
                maxOf(
                    1L,
                    ((kotlin.math.floor(seconds * 12) + 1) / 12 * 1000 - seconds * 1000 - 8)
                        .toLong(),
                ),
            )
        }
    }

    override fun close() {
        if (closed) return
        closed = true
        captures.close()
        scope.cancel()
        choreographer.removeFrameCallback(callback)
        detach()
        effects.close()
        assets.close()
        lights.close()
        engine.destroyCameraComponent(camera.entity)
        EntityManager.get().destroy(camera.entity)
        engine.destroyView(view)
        scene.skybox = null
        engine.destroySkybox(background)
        engine.destroyScene(scene)
        engine.destroyRenderer(renderer)
        engine.destroy()
    }
}
