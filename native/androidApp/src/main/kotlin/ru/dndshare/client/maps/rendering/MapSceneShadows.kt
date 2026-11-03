package ru.dndshare.client.maps.rendering

import com.google.android.filament.*
import kotlinx.coroutines.*
import ru.dndshare.client.maps.*

/** Dedicated shadow GLBs share instance poses, upload no images, and never enter picking/depth. */
internal class MapSceneShadows(
    private val engine: Engine,
    private val scene: Scene,
    gpu: MapGpuMaterials,
    private val cache: MapAssetCache,
    private val scope: CoroutineScope,
    private val changed: () -> Unit,
    private val error: (String?) -> Unit,
) : AutoCloseable {
    private data class Instance(val url: String, val parts: List<MapGpuEntity>)

    private val material = gpu.instance("shadow")
    private val meshes = mutableMapOf<String, List<MapGpuMesh>>()
    private val instances = mutableMapOf<MapEntityRef, Instance>()
    private val loading = mutableMapOf<String, Job>()
    private var entries = emptyList<MapSceneEntry>()
    private val retries =
        MapAssetRetries(
            scope,
            { url -> entries.any { it.model.raw.string("shadowUrl") == url } },
            { url, stage ->
                if (stage == "download") cache.downloads.invalidate(url) else cache.invalidate(url)
            },
            ::load,
            ::report,
            { cache.downloads.state.value[it] },
        )

    private fun report() {
        error(retries.message)
        changed()
    }

    val working
        get() = loading.isNotEmpty()

    val pendingUrls
        get() = loading.keys.toSet()

    val failures
        get() = retries.issues

    var mask = emptySet<MapEntityRef>()
        private set

    var hidden = emptySet<MapEntityRef>()
        private set

    fun update(context: MapContext, drawn: List<MapSceneEntry>) {
        hidden =
            drawn
                .filter { context.opacity(it.ref.kind.wire, it.ref.id, ghost = false) <= .001f }
                .map { it.ref }
                .toSet()
        entries =
            if (context.document.flag("lightingEnabled"))
                drawn.filter { it.ref !in hidden && it.model.raw.string("shadowUrl").isNotBlank() }
            else emptyList()
        val wanted = entries.associateBy { it.ref }
        instances.keys
            .filter { ref -> wanted[ref]?.model?.raw?.string("shadowUrl") != instances[ref]?.url }
            .forEach { instances.remove(it)?.parts?.forEach(MapGpuEntity::close) }
        val urls = entries.map { it.model.raw.string("shadowUrl") }.toSet()
        retries.retain(urls)
        loading.keys.filter { it !in urls }.forEach { loading.remove(it)?.cancel() }
        meshes.keys.filter { it !in urls }.forEach { meshes.remove(it)?.forEach(MapGpuMesh::close) }
        for (url in urls) if (url !in meshes && url !in loading && url !in retries) load(url)
        synchronize()
        error(retries.message)
    }

    private fun load(url: String) {
        if (url in loading) return
        retries.starting(url)
        val job =
            scope.launch(start = CoroutineStart.LAZY) {
                try {
                    val parts = cache.geometry(url).second
                    if (entries.none { it.model.raw.string("shadowUrl") == url }) return@launch
                    val uploaded = mutableListOf<MapGpuMesh>()
                    try {
                        for (part in parts) uploaded += MapGpuMesh(engine, part.geometry)
                        meshes[url] = uploaded
                    } catch (failure: Throwable) {
                        uploaded.forEach(MapGpuMesh::close)
                        throw failure
                    }
                    synchronize()
                    retries.ready(url)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (failure: Exception) {
                    retries.fail(url, failure, "geometry")
                } finally {
                    if (loading[url] === coroutineContext[Job]) loading.remove(url)
                }
            }
        loading[url] = job
        job.start()
    }

    private fun synchronize() {
        for (entry in entries) {
            val url = entry.model.raw.string("shadowUrl")
            val parts = meshes[url] ?: continue
            val instance =
                instances.getOrPut(entry.ref) {
                    Instance(
                        url,
                        parts.map {
                            MapGpuEntity(
                                    engine,
                                    scene,
                                    it,
                                    material,
                                    shadows = true,
                                    ownsMaterial = false,
                                )
                                .also { entity -> entity.layer(128) }
                        },
                    )
                }
            instance.parts.forEach { it.transform(entry.matrix) }
        }
        val next = hidden + instances.keys
        if (next != mask) mask = next
    }

    fun transforms(changed: List<MapSceneEntry>) {
        for (entry in changed) instances[entry.ref]?.parts?.forEach { it.transform(entry.matrix) }
    }

    fun retry() = retries.retry()

    override fun close() {
        retries.close()
        loading.values.forEach(Job::cancel)
        loading.clear()
        instances.values.flatMap { it.parts }.forEach(MapGpuEntity::close)
        instances.clear()
        meshes.values.flatten().forEach(MapGpuMesh::close)
        meshes.clear()
        engine.destroyMaterialInstance(material)
    }
}
