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
    private val changed: () -> Unit,
) : AutoCloseable {
    private val materials = UbershaderProvider(engine)
    private val loader = AssetLoader(engine, materials, EntityManager.get())
    private val resources = ResourceLoader(engine, true)
    private val groundResources = ResourceLoader(engine, true)
    private val pools = mutableMapOf<String, MapModelPool>()
    private val retiring = mutableMapOf<String, MapModelPool>()
    private var drawn = emptyMap<MapEntityRef, MapSceneEntry>()
    val drawnEntries
        get() = drawn.values.toList()

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

    val hasGround
        get() = ground != null

    val working
        get() = loading != null || downloaded.isNotEmpty()

    fun update(document: JsonObject, value: List<MapSceneEntry>, groundVisible: Boolean = true) {
        entries = value
        ensureWantedPools()
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

    private fun availablePool(url: String) =
        pools[url]?.takeIf { it.ready } ?: retiring[url]?.takeIf { it.ready }

    private fun synchronize() {
        val resolved = entries.map { entry ->
            if (availablePool(entry.model.renderUrl) != null) entry
            else
                drawn[entry.ref]
                    ?.takeIf {
                        it.model.uuid == entry.model.uuid &&
                            availablePool(it.model.renderUrl) != null
                    }
                    ?.let { old ->
                        entry.copy(model = entry.model.copy(renderUrl = old.model.renderUrl))
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
                val manager = engine.transformManager
                manager.setTransform(manager.getInstance(instance.root), entry.matrix)
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
    }

    private fun destroyPool(pool: MapModelPool) {
        pool.instances.forEach { scene.removeEntities(it.entities) }
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
        resources.asyncCancelLoad()
        pools.keys.toList().forEach(::removePool)
        retiring.values.forEach(::destroyPool)
        retiring.clear()
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
