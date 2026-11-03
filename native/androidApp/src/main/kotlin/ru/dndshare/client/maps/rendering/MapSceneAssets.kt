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
    private val scene: Scene,
    private val cache: MapAssetCache,
    private val scope: CoroutineScope,
    private val requestFrame: () -> Unit,
    private val status: (Int, String?) -> Unit,
) : AutoCloseable {
    private val materials = UbershaderProvider(engine)
    private val loader = AssetLoader(engine, materials, EntityManager.get())
    private val resources = ResourceLoader(engine, true)
    private val groundResources = ResourceLoader(engine, true)
    private val pools = mutableMapOf<String, MapModelPool>()
    private val pending = mutableSetOf<String>()
    private val failed = mutableSetOf<String>()
    private val slots = Semaphore(3)
    private val downloaded = ArrayDeque<DownloadedModel>()
    private var loading: MapModelPool? = null
    private var ground: FilamentAsset? = null
    private var groundKey = ""
    private var entries = emptyList<MapSceneEntry>()
    val entities = mutableMapOf<Int, MapEntityRef>()
    val readyModelUrls
        get() = pools.filterValues { it.ready }.keys.toSet()

    val bounds
        get() = pools.filterValues { it.ready }.mapValues { it.value.asset.boundingBox }

    val modelCount
        get() = pools.size

    val fileBytes
        get() = pools.values.sumOf { it.fileBytes }

    val pendingCount
        get() = pending.size

    val hasGround
        get() = ground != null

    val working
        get() = loading != null || downloaded.isNotEmpty()

    fun update(document: JsonObject, value: List<MapSceneEntry>, groundVisible: Boolean = true) {
        entries = value
        val wanted = entries.groupBy { it.model.renderUrl }
        pools.keys.filter { it !in wanted }.forEach(::removePool)
        for ((url, group) in wanted) {
            val pool = pools[url]
            if (pool != null && pool.capacity < group.size && loading !== pool) removePool(url)
            if (url !in pools && url !in pending && url !in failed) download(url)
        }
        val w = document.number("width").toInt()
        val h = document.number("height").toInt()
        val grid = (document["grid"] as? JsonObject)?.flag("visible") ?: true
        val key = "$w:$h:$grid:$groundVisible"
        if (groundKey != key) {
            ground?.let {
                scene.removeEntities(it.entities)
                loader.destroyAsset(it)
            }
            ground =
                if (!groundVisible) null
                else
                    loader.createAsset(mapGroundGlb(w, h, grid))?.also {
                        groundResources.loadResources(it)
                        scene.addEntities(it.entities)
                        it.releaseSourceData()
                    }
            groundKey = key
        }
        synchronize()
    }

    fun advance() {
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
    }

    fun retry() {
        failed.clear()
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
            val pool =
                MapModelPool(
                    url,
                    asset,
                    instances.map { requireNotNull(it) },
                    source.bytes.size.toLong(),
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

    private fun synchronize() {
        entities.clear()
        for ((url, pool) in pools) {
            if (!pool.ready) continue
            val wanted = entries.filter { it.model.renderUrl == url }
            val ids = wanted.map { it.ref }.toSet()
            pool.assigned.keys
                .filter { it !in ids }
                .forEach { id ->
                    pool.assigned.remove(id)?.let { scene.removeEntities(it.entities) }
                }
            val used = pool.assigned.values.toSet()
            val available = ArrayDeque(pool.instances.filter { it !in used })
            for (entry in wanted) {
                val instance =
                    pool.assigned[entry.ref]
                        ?: available.removeFirstOrNull()?.also {
                            pool.assigned[entry.ref] = it
                            scene.addEntities(it.entities)
                        }
                        ?: continue
                val manager = engine.transformManager
                manager.setTransform(manager.getInstance(instance.root), entry.matrix)
                instance.entities.forEach { entities[it] = entry.ref }
            }
        }
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
        resources.asyncCancelLoad()
        pools.keys.toList().forEach(::removePool)
        ground?.let { loader.destroyAsset(it) }
        resources.destroy()
        groundResources.destroy()
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
) {
    val capacity
        get() = instances.size

    val assigned = mutableMapOf<MapEntityRef, FilamentInstance>()
    var ready = false
}

private class DownloadedModel(
    val url: String,
    val bytes: ByteArray,
    val consumed: CompletableDeferred<Unit>,
)
