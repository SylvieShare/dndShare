package ru.dndshare.client.maps.rendering

import com.google.android.filament.*
import com.google.android.filament.gltfio.*
import java.nio.ByteBuffer
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.maps.*

/** Asset lifetimes, bounded uploads and pooled instances have one renderer-thread owner. */
internal class MapSceneAssets(
    private val engine: Engine,
    gpu: MapGpuMaterials,
    private val scene: Scene,
    private val cache: MapAssetCache,
    private val scope: CoroutineScope,
    private val requestFrame: () -> Unit,
    private val status: (Int, String?) -> Unit,
    private val changed: () -> Unit,
) : AutoCloseable {
    val renderMaterials
        get() = primitives.renderMaterials

    private val primitives = MapPrimitiveMaterials(engine, gpu)
    private var replaced = emptyMap<String, Set<MapPrimitiveRef>>()

    fun waterParts(value: Map<String, Set<MapPrimitiveRef>>) {
        if (value == replaced) return
        replaced = value
        synchronize()
    }

    private val materials = UbershaderProvider(engine)
    private val loader = AssetLoader(engine, materials, EntityManager.get())
    private val resources = ResourceLoader(engine, true)
    private val pools = mutableMapOf<String, MapModelPool>()
    private val retiring = mutableMapOf<String, MapModelPool>()
    private val poses = MapSceneMotion()
    private var context: MapContext? = null
    private val surfaces =
        MapSceneSurfaces(poses, ::bindSurface) { entry ->
            availablePool(entry.model.renderUrl)?.hasTransparency == true
        }
    val surfaceGroups
        get() = surfaces.surfaceGroups

    val surfaceIds
        get() = surfaces.surfaceIds

    var visualAnchors = MapVisualAnchors()
        private set

    val motionMoving
        get() = poses.moving

    val motionEntries
        get() = poses.transformed.mapNotNull { drawn[it] }

    val appearanceEntries
        get() = poses.changed.mapNotNull { drawn[it] }

    fun animate(seconds: Double, enabled: Boolean): Boolean {
        val moving = poses.advance(seconds, enabled)
        applyPoses(poses.transformed)
        if (poses.appearanceChanged) surfaces.refresh(drawn)
        visualAnchors = poses.anchors()
        return moving
    }

    private fun applyPoses(refs: Collection<MapEntityRef>) {
        if (refs.isEmpty()) return
        val manager = engine.transformManager
        manager.openLocalTransformTransaction()
        try {
            for (ref in refs) {
                val entry = drawn[ref] ?: continue
                val instance = availablePool(entry.model.renderUrl)?.assigned?.get(ref) ?: continue
                val matrix = poses.matrix(ref) ?: continue
                manager.setTransform(manager.getInstance(instance.root), matrix)
                drawn[ref] = entry.copy(matrix = matrix)
            }
        } finally {
            manager.commitLocalTransformTransaction()
        }
    }

    private var drawn = mutableMapOf<MapEntityRef, MapSceneEntry>()
    val drawnEntries
        get() = drawn.values.toList()

    private val pending = mutableSetOf<String>()
    private val jobs = mutableMapOf<String, Job>()
    private val failed = mutableSetOf<String>()
    private val slots = Semaphore(3)
    private val downloaded = ArrayDeque<DownloadedModel>()
    private var loading: MapModelPool? = null
    private var entries = emptyList<MapSceneEntry>()
    val entities = mutableMapOf<Int, MapEntityRef>()
    val readyModelUrls
        get() = pools.filterValues { it.ready }.keys.toSet()

    val bounds
        get() =
            (pools.values + retiring.values)
                .filter { it.ready }
                .associate { it.url to it.asset.boundingBox }

    val modelCount
        get() = (pools.keys + retiring.keys).toSet().size

    val fileBytes
        get() = (pools.values + retiring.values).sumOf { it.fileBytes }

    val pendingCount
        get() = pending.size

    val working
        get() = loading != null || downloaded.isNotEmpty()

    private var selection = emptySet<MapEntityRef>()

    fun selection(value: Set<MapEntityRef>) {
        if (value == selection) return
        selection = value
        synchronize()
    }

    fun update(value: List<MapSceneEntry>, context: MapContext) {
        this.context = context
        entries = value
        val wanted = entries.map { it.model.renderUrl }.toSet()
        jobs.keys
            .filter { it !in wanted }
            .forEach { url ->
                jobs.remove(url)?.cancel()
                pending -= url
                downloaded
                    .filter { it.url == url }
                    .forEach {
                        downloaded.remove(it)
                        it.consumed.complete(Unit)
                    }
            }
        ensureWantedPools()
        synchronize()
    }

    private fun ensureWantedPools() {
        val wanted = entries.groupBy { it.model.renderUrl }
        for ((url, group) in wanted) {
            val pool = pools[url]
            if (pool != null && pool.capacity < group.size && loading !== pool) {
                if (pool.ready) {
                    retiring.remove(url)?.let(::destroyPool)
                    retiring[url] = pool
                    pools.remove(url)
                } else removePool(url)
            }
            if (url !in pools && url !in pending && url !in failed) download(url)
        }
    }

    fun advance() {
        loadNext()
        loading?.let { pool ->
            resources.asyncUpdateLoad()
            if (resources.asyncGetLoadProgress() >= 1f) {
                pool.ready = true
                loading = null
                pending -= pool.url
                retiring.remove(pool.url)?.let(::destroyPool)
                synchronize()
                ensureWantedPools()
                changed()
                status(pending.size, null)
            }
        }
    }

    fun retry() {
        failed.clear()
    }

    private fun download(url: String) {
        pending += url
        status(pending.size, null)
        val job =
            scope.launch(start = CoroutineStart.LAZY) {
                try {
                    slots.withPermit {
                        val original = cache.bytes(url)
                        val model = withContext(Dispatchers.Default) { prepareMapModel(original) }
                        val consumed = CompletableDeferred<Unit>()
                        downloaded.addLast(DownloadedModel(url, model, consumed))
                        requestFrame()
                        consumed.await()
                    }
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (error: Exception) {
                    pending -= url
                    failed += url
                    status(pending.size, error.message)
                } finally {
                    if (jobs[url] === coroutineContext[Job]) jobs.remove(url)
                }
            }
        jobs[url] = job
        job.start()
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
                    loader.createInstancedAsset(ByteBuffer.wrap(source.model.bytes), instances)
                ) {
                    "Не удалось открыть GLB-модель"
                }
            val pool =
                MapModelPool(
                    url,
                    asset,
                    instances.map { requireNotNull(it) },
                    source.model.bytes.size.toLong(),
                    source.model.materials,
                )
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

    private fun availablePool(url: String) =
        pools[url]?.takeIf { it.ready } ?: retiring[url]?.takeIf { it.ready }

    private fun synchronize() {
        val resolved = entries.map { entry ->
            if (availablePool(entry.model.renderUrl) != null) entry
            else
                drawn[entry.ref]
                    ?.takeIf {
                        availablePool(it.model.renderUrl) != null
                    }
                    ?.let { old ->
                        if (old.model.uuid == entry.model.uuid)
                            entry.copy(model = entry.model.copy(renderUrl = old.model.renderUrl))
                        else poses.target(entry.ref) ?: old
                    } ?: entry
        }
        val needed = (entries + resolved).map { it.model.renderUrl }.toSet()
        pools.keys.filter { it !in needed }.forEach(::removePool)
        retiring.keys.filter { it !in needed }.forEach { retiring.remove(it)?.let(::destroyPool) }
        entities.clear()
        val actual = mutableMapOf<MapEntityRef, MapSceneEntry>()
        for (url in resolved.map { it.model.renderUrl }.distinct()) {
            val pool = availablePool(url) ?: continue
            val wanted = resolved.filter { it.model.renderUrl == url }
            val ids = wanted.map { it.ref }.toSet()
            pool.assigned.keys
                .filter { it !in ids }
                .forEach { id ->
                    pool.assigned.remove(id)?.let { scene.removeEntities(it.entities) }
                }
            val used = pool.assigned.values.toSet()
            val spare = ArrayDeque(pool.instances.filter { it !in used })
            for (entry in wanted) {
                val instance =
                    pool.assigned[entry.ref]
                        ?: spare.removeFirstOrNull()?.also {
                            pool.assigned[entry.ref] = it
                            scene.addEntities(it.entities)
                        }
                        ?: continue
                primitives.apply(
                    pool.asset,
                    instance,
                    replaced[url].orEmpty(),
                    surfaceIds[entry.ref] ?: 0,
                    pool.descriptors,
                    MapSurfaceStyle(entry.opacity, entry.brightness),
                    entry.ref in selection,
                )
                instance.entities.forEach { entities[it] = entry.ref }
                actual[entry.ref] = entry
            }
        }
        // A pool that stays for an in-flight upgrade must not keep deleted or replaced instances.
        val assignedByUrl =
            actual.values
                .groupBy { it.model.renderUrl }
                .mapValues { (_, rows) -> rows.map { it.ref }.toSet() }
        for (pool in pools.values + retiring.values) {
            val active = assignedByUrl[pool.url].orEmpty()
            if (pool !== availablePool(pool.url)) {
                pool.assigned.values.forEach { scene.removeEntities(it.entities) }
                pool.assigned.clear()
            } else
                pool.assigned.keys
                    .filter { it !in active }
                    .forEach { id ->
                        pool.assigned.remove(id)?.let { scene.removeEntities(it.entities) }
                    }
        }
        drawn = actual
        context?.let { poses.sync(actual, it) }
        applyPoses(actual.keys)
        surfaces.refresh(drawn, force = true)
    }

    private fun bindSurface(entry: MapSceneEntry, id: Int) {
        val ref = entry.ref
        val pool = availablePool(entry.model.renderUrl) ?: return
        val instance = pool.assigned[ref] ?: return
        primitives.apply(
            pool.asset,
            instance,
            replaced[pool.url].orEmpty(),
            id,
            pool.descriptors,
            MapSurfaceStyle(entry.opacity, entry.brightness),
            ref in selection,
        )
    }

    private fun destroyPool(pool: MapModelPool) {
        primitives.restore(pool.instances)
        pool.instances.forEach { instance ->
            scene.removeEntities(instance.entities)
            instance.entities.forEach(engine::destroyEntity)
        }
        primitives.forget(pool.instances)
        loader.destroyAsset(pool.asset)
    }

    private fun removePool(url: String) {
        pending -= url
        pools.remove(url)?.let { pool ->
            if (loading === pool) {
                resources.asyncCancelLoad()
                loading = null
            }
            destroyPool(pool)
        }
    }

    override fun close() {
        jobs.values.forEach(Job::cancel)
        jobs.clear()
        resources.asyncCancelLoad()
        pools.keys.toList().forEach(::removePool)
        retiring.values.forEach(::destroyPool)
        retiring.clear()
        resources.destroy()
        poses.clear()
        primitives.close()
        loader.destroy()
        materials.destroyMaterials()
        materials.destroy()
    }
}

private class MapModelPool(
    val url: String,
    val asset: FilamentAsset,
    val instances: List<FilamentInstance>,
    val fileBytes: Long,
    val descriptors: Map<MapPrimitiveRef, JsonObject>,
) {
    val hasTransparency = descriptors.values.any { it.string("alphaMode") == "BLEND" }
    val capacity
        get() = instances.size

    val assigned = mutableMapOf<MapEntityRef, FilamentInstance>()
    var ready = false
}

private class DownloadedModel(
    val url: String,
    val model: MapPreparedModel,
    val consumed: CompletableDeferred<Unit>,
)
