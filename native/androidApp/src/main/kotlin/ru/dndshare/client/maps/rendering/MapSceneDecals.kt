package ru.dndshare.client.maps.rendering

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import coil3.ImageLoader
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.allowHardware
import coil3.svg.SvgDecoder
import com.google.android.filament.*
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.geometry.*

/** Projection is prepared on the CPU; only immutable buffers cross to the render looper. */
internal class MapSceneDecals(
    private val context: Context,
    private val engine: Engine,
    private val scene: Scene,
    private val gpu: MapGpuMaterials,
    private val cache: MapAssetCache,
    private val scope: CoroutineScope,
    private val changed: () -> Unit,
    private val error: (String?) -> Unit,
) : AutoCloseable {
    private data class Record(
        val shape: String,
        val meshes: List<MapGpuMesh>,
        val entities: List<MapGpuEntity>,
    ) : AutoCloseable {
        override fun close() {
            entities.forEach(MapGpuEntity::close)
            meshes.forEach(MapGpuMesh::close)
        }
    }

    private val images =
        ImageLoader.Builder(context).components { add(SvgDecoder.Factory()) }.build()
    private val records = mutableMapOf<String, Record>()
    private val loading = mutableMapOf<String, Pair<String, Job>>()
    private val failed = mutableSetOf<String>()
    private val slots = Semaphore(2)
    private var document = JsonObject(emptyMap())
    private var entries = emptyMap<MapEntityRef, MapSceneEntry>()
    private var appearance: MapContext? = null
    private var closed = false
    val working
        get() = loading.isNotEmpty()

    val count
        get() = records.size

    val picks
        get() =
            records
                .flatMap { (id, record) ->
                    record.entities.map { it.entity to MapEntityRef(MapEntityKind.Decal, id) }
                }
                .toMap()

    fun update(value: MapContext, models: List<MapSceneEntry>) {
        document = value.document
        appearance = value
        entries = models.associateBy { it.ref }
        val decals = document.rows("decals").associateBy { it.string("id") }
        records.keys.filter { it !in decals }.forEach { records.remove(it)?.close() }
        loading.keys.filter { it !in decals }.forEach { loading.remove(it)?.second?.cancel() }
        for ((id, decal) in decals) {
            val owner = entries[mapAnchorRef(decal["anchor"] as? JsonObject)] ?: continue
            val shape = shape(decal, owner)
            if (records[id]?.shape != shape) {
                records.remove(id)?.close()
            }
            if (loading[id]?.first != shape) loading.remove(id)?.second?.cancel()
            if (id !in records && id !in loading && "$id:$shape" !in failed)
                load(id, decal, owner, shape)
        }
        synchronize()
    }

    private fun shape(decal: JsonObject, owner: MapSceneEntry) =
        listOf(
                owner.model.renderUrl,
                decal["position"],
                decal["normal"],
                decal["width"],
                decal["height"],
                decal["depth"],
                decal["rotation"],
                decal["imageUrl"],
            )
            .toString()

    private fun load(id: String, decal: JsonObject, owner: MapSceneEntry, shape: String) {
        val job =
            scope.launch(start = CoroutineStart.LAZY) {
                var bitmap: Bitmap? = null
                try {
                    slots.withPermit {
                        val (_, parts) = cache.geometry(owner.model.renderUrl)
                        val bytes = cache.media(decal.string("imageUrl"))
                        var meshes = emptyList<MeshGeometry>()
                        withContext(Dispatchers.Default) {
                            val result =
                                images.execute(
                                    ImageRequest.Builder(context)
                                        .data(bytes)
                                        .size(2048)
                                        .allowHardware(false)
                                        .build()
                                ) as? SuccessResult
                            val image =
                                requireNotNull(result?.image) {
                                    "Не удалось открыть изображение декали"
                                }
                            val scale = minOf(1f, 2048f / maxOf(image.width, image.height))
                            bitmap =
                                Bitmap.createBitmap(
                                        maxOf(1, (image.width * scale).toInt()),
                                        maxOf(1, (image.height * scale).toInt()),
                                        Bitmap.Config.ARGB_8888,
                                    )
                                    .also { b ->
                                        val canvas = Canvas(b)
                                        canvas.scale(
                                            b.width.toFloat() / image.width,
                                            b.height.toFloat() / image.height,
                                        )
                                        image.draw(canvas)
                                    }
                            val p = decal.array("position")
                            val n = decal.array("normal")
                            val point =
                                Vec3(
                                    p.double(0).toFloat(),
                                    p.double(1).toFloat(),
                                    p.double(2).toFloat(),
                                )
                            val normal =
                                Vec3(
                                    n.double(0).toFloat(),
                                    n.double(1, 1.0).toFloat(),
                                    n.double(2).toFloat(),
                                )
                            meshes =
                                parts
                                    .map {
                                        projectDecal(
                                            it.geometry,
                                            point,
                                            normal,
                                            decal.number("width", 1.0).toFloat(),
                                            decal.number("height", 1.0).toFloat(),
                                            decal.number("depth", .15).toFloat(),
                                            decal.number("rotation").toFloat(),
                                        )
                                    }
                                    .filter { it.indices.isNotEmpty() }
                        }
                        if (closed || loading[id]?.first != shape) return@withPermit
                        val uploaded = mutableListOf<MapGpuMesh>()
                        val entities = mutableListOf<MapGpuEntity>()
                        try {
                            for (mesh in meshes) {
                                val geometry = MapGpuMesh(engine, mesh)
                                uploaded += geometry
                                val material =
                                    gpu.configure("decal") { instance ->
                                        val texture =
                                            gpu.texture(
                                                instance,
                                                "decal:${decal.string("imageUrl")}",
                                                requireNotNull(bitmap),
                                                true,
                                            )
                                        instance.setParameter(
                                            "albedo",
                                            texture,
                                            TextureSampler(
                                                TextureSampler.MinFilter.LINEAR_MIPMAP_LINEAR,
                                                TextureSampler.MagFilter.LINEAR,
                                                TextureSampler.WrapMode.CLAMP_TO_EDGE,
                                            ),
                                        )
                                        instance.setPolygonOffset(-2f, -2f)
                                    }
                                entities +=
                                    MapGpuEntity(
                                        engine,
                                        scene,
                                        geometry,
                                        material,
                                        priority = 6,
                                        releaseMaterial = gpu::release,
                                    )
                            }
                            records[id] = Record(shape, uploaded, entities)
                            synchronize()
                            changed()
                        } catch (failure: Throwable) {
                            entities.forEach(MapGpuEntity::close)
                            uploaded.forEach(MapGpuMesh::close)
                            throw failure
                        }
                    }
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (failure: Exception) {
                    failed += "$id:$shape"
                    error(failure.message)
                } finally {
                    bitmap?.recycle()
                    if (loading[id]?.second === coroutineContext[Job]) loading.remove(id)
                }
            }
        loading[id] = shape to job
        job.start()
    }

    private fun synchronize() {
        for (decal in document.rows("decals")) {
            val anchor = decal["anchor"] as? JsonObject ?: continue
            val owner = entries[mapAnchorRef(anchor)]
            val opacity =
                if (owner == null) 0f
                else
                    (appearance?.opacity(anchor.string("kind"), anchor.string("id")) ?: 1f) *
                        decal.number("opacity", 1.0).toFloat()
            val colour = mapLinearColour(decal.string("color", "#ffffff"))
            for (entity in records[decal.string("id")]?.entities.orEmpty()) {
                entity.visible(opacity > .001f)
                if (owner != null) entity.transform(owner.matrix)
                entity.material.setParameter(
                    "tint",
                    colour[0] * opacity,
                    colour[1] * opacity,
                    colour[2] * opacity,
                    opacity,
                )
            }
        }
    }

    fun retry() {
        failed.clear()
        appearance?.let { update(it, entries.values.toList()) }
    }

    override fun close() {
        closed = true
        loading.values.forEach { it.second.cancel() }
        loading.clear()
        records.values.forEach(Record::close)
        records.clear()
        images.shutdown()
    }
}
