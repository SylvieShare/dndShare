package ru.dndshare.client.maps.rendering

import android.content.Context
import android.graphics.Bitmap
import java.security.MessageDigest
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*

/** One serial renderer and a bounded image cache belong to one API/account map workspace. */
class MapSnapshotQueue(private val context: Context, private val assets: MapAssetCache) :
    AutoCloseable {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val lock = Mutex()
    private val images = LinkedHashMap<String, Bitmap>(16, .75f, true)
    private var renderer: MapSnapshotRenderer? = null
    private var idle: Job? = null
    @Volatile private var closed = false
    @Volatile private var rendering: Job? = null

    suspend fun snapshot(
        document: JsonObject,
        models: List<MapModel>,
        camera: MapCamera? = null,
        focus: Set<MapEntityRef>? = null,
        width: Int = 420,
        height: Int = 280,
        lod: Boolean = true,
        key: String? = null,
    ): Bitmap = coroutineScope {
        require(width in 64..1024 && height in 64..1024)
        val settings = MapRenderSettings.get(context)
        settings.ready()
        val forceLod = lod || settings.forceLod.value
        val signature =
            withContext(Dispatchers.Default) {
                val used =
                    (document.rows("tiles") + document.rows("objects"))
                        .map { it.string("modelId") }
                        .toSet()
                val bytes =
                    listOf(
                            key ?: document.without("tags", "cameras"),
                            if (key == null) models.filter { it.uuid in used } else emptyList(),
                            camera,
                            focus?.sortedBy { it.key },
                            width,
                            height,
                            forceLod,
                        )
                        .toString()
                        .toByteArray()
                MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") {
                    "%02x".format(it)
                }
            }
        lock.withLock {
            check(!closed) { "Очередь превью закрыта" }
            idle?.cancel()
            try {
                images[signature]?.let {
                    return@withLock it
                }
                val worker = renderer ?: MapSnapshotRenderer(context, assets).also { renderer = it }
                rendering = currentCoroutineContext()[Job]
                check(!closed) { "Очередь превью закрыта" }
                val bitmap =
                    try {
                        worker.render(document, models, width, height, camera, focus, forceLod)
                    } catch (failure: Exception) {
                        worker.close()
                        renderer = null
                        throw failure
                    }
                images[signature] = bitmap
                var bytes = images.values.sumOf { it.allocationByteCount.toLong() }
                val iterator = images.entries.iterator()
                while (bytes > 8L * 1024 * 1024 && images.size > 1 && iterator.hasNext()) {
                    val removed = iterator.next()
                    bytes -= removed.value.allocationByteCount
                    iterator.remove()
                }
                bitmap
            } finally {
                rendering = null
                idle = scope.launch {
                    delay(30_000)
                    lock.withLock {
                        renderer?.close()
                        renderer = null
                    }
                }
            }
        }
    }

    override fun close() {
        closed = true
        rendering?.cancel(CancellationException("Очередь превью закрыта"))
        scope.launch {
            lock.withLock {
                closed = true
                idle?.cancel()
                renderer?.close()
                renderer = null
                images.clear()
            }
            scope.cancel()
        }
    }
}
