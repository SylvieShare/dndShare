package ru.dndshare.client.maps.rendering

import android.graphics.Bitmap
import com.google.android.filament.*
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.geometry.mapEffectPhase

internal class MapSceneWater(
    private val engine: Engine,
    private val scene: Scene,
    private val gpu: MapGpuMaterials,
    private val cache: MapAssetCache,
    private val scope: CoroutineScope,
    private val changed: () -> Unit,
    private val error: (String?) -> Unit,
) : AutoCloseable {
    private data class Part(val mesh: MapGpuMesh, val material: MaterialInstance)

    private val models = mutableMapOf<String, List<Part>>()
    private val entities = mutableMapOf<MapEntityRef, List<MapGpuEntity>>()
    private val entityModels = mutableMapOf<MapEntityRef, String>()
    private val loading = mutableMapOf<String, Job>()
    private val failed = mutableSetOf<String>()
    private var entries = emptyList<MapSceneEntry>()
    val working
        get() = loading.isNotEmpty()

    val picks
        get() = entities.flatMap { (id, items) -> items.map { it.entity to id } }.toMap()

    private var closed = false
    val modelCount
        get() = models.values.count { it.isNotEmpty() }

    private val slots = Semaphore(2)

    fun update(value: List<MapSceneEntry>) {
        entries = value.filter {
            (it.model.behaviour["waterAnimation"] as? JsonObject)?.flag("enabled") == true
        }
        val urls = entries.map { it.model.renderUrl }.toSet()
        entities.keys
            .filter { id ->
                entries.none { it.ref == id && it.model.renderUrl == entityModels[id] }
            }
            .forEach {
                entities.remove(it)?.forEach(MapGpuEntity::close)
                entityModels.remove(it)
            }
        models.keys
            .filter { it !in urls }
            .forEach { url ->
                models.remove(url)?.forEach {
                    it.mesh.close()
                    gpu.release(it.material)
                }
            }
        loading.keys.filter { it !in urls }.forEach { loading.remove(it)?.cancel() }
        for (url in urls) if (url !in models && url !in loading && url !in failed) load(url)
        synchronize()
    }

    private fun load(url: String) {
        val job =
            scope.launch(start = CoroutineStart.LAZY) {
                var prepared: List<MapWaterPart>? = null
                try {
                    slots.withPermit {
                        val (source, parts) = cache.geometry(url)
                        withContext(Dispatchers.Default) {
                            prepared = prepareWaterTextures(source, parts, url)
                        }
                        if (closed || entries.none { it.model.renderUrl == url }) return@withPermit
                        val created = mutableListOf<Part>()
                        try {
                            for (part in prepared.orEmpty()) {
                                val settings =
                                    entries
                                        .first { it.model.renderUrl == url }
                                        .model
                                        .behaviour["waterAnimation"]!!
                                        .jsonObject
                                val pbr = part.part.material["pbrMetallicRoughness"] as? JsonObject
                                if (
                                    part.textures["orm"] == null &&
                                        (pbr?.number("roughnessFactor", 1.0) ?: 1.0) >=
                                            settings.number("roughnessMax", .5)
                                )
                                    continue
                                val mesh = MapGpuMesh(engine, part.part.geometry)
                                try {
                                    created += Part(mesh, configureWaterMaterial(gpu, part))
                                } catch (error: Throwable) {
                                    mesh.close()
                                    throw error
                                }
                            }
                            models[url] = created
                            synchronize()
                            changed()
                        } catch (failure: Throwable) {
                            created.forEach {
                                it.mesh.close()
                                gpu.release(it.material)
                            }
                            throw failure
                        }
                    }
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (failure: Exception) {
                    failed += url
                    error(failure.message)
                } finally {
                    prepared
                        .orEmpty()
                        .flatMap { it.textures.values }
                        .map { it.bitmap }
                        .distinct()
                        .forEach(Bitmap::recycle)
                    if (loading[url] === coroutineContext[Job]) loading.remove(url)
                }
            }
        loading[url] = job
        job.start()
    }

    private fun synchronize() {
        for (entry in entries) {
            val parts = models[entry.model.renderUrl] ?: continue
            val renderables =
                entities.getOrPut(entry.ref) {
                    entityModels[entry.ref] = entry.model.renderUrl
                    parts.map {
                        MapGpuEntity(
                            engine,
                            scene,
                            it.mesh,
                            it.material,
                            priority = 5,
                            ownsMaterial = false,
                        )
                    }
                }
            renderables.forEach {
                it.transform(entry.matrix)
                it.layer(if (entry.opacity < 1f) 2 else 1)
            }
            val settings = entry.model.behaviour["waterAnimation"]!!.jsonObject
            for (part in parts) {
                part.material.setParameter("strength", settings.number("strength", .5).toFloat())
                part.material.setParameter(
                    "roughnessMax",
                    settings.number("roughnessMax", .5).toFloat(),
                )
                part.material.setParameter(
                    "pattern",
                    when (settings.string("pattern", "pool")) {
                        "surface" -> 1f
                        "vortex" -> 2f
                        else -> 0f
                    },
                )
                part.material.setParameter(
                    "center",
                    settings.array("center").double(0).toFloat(),
                    settings.array("center").double(1).toFloat(),
                )
            }
        }
    }

    fun advance(seconds: Double, motion: Boolean): Boolean {
        var active = false
        for (entry in entries.distinctBy { it.model.renderUrl }) {
            val settings = entry.model.behaviour["waterAnimation"]!!.jsonObject
            val moving =
                motion && settings.number("speed", 1.0) > 0 && settings.number("strength", .5) > 0
            models[entry.model.renderUrl]?.forEach {
                it.material.setParameter(
                    "clock",
                    if (moving) mapEffectPhase(seconds, settings.number("speed", 1.0)).toFloat()
                    else 0f,
                )
            }
            active = active || moving && models[entry.model.renderUrl]?.isNotEmpty() == true
        }
        return active
    }

    fun retry() {
        failed.clear()
        update(entries)
    }

    override fun close() {
        closed = true
        loading.values.forEach(Job::cancel)
        loading.clear()
        entities.values.flatten().forEach(MapGpuEntity::close)
        entities.clear()
        models.values.flatten().forEach {
            it.mesh.close()
            gpu.release(it.material)
        }
        models.clear()
    }
}
