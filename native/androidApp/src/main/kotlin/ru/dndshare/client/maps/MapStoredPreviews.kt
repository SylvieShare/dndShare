package ru.dndshare.client.maps

import android.graphics.Bitmap
import android.os.Build
import java.io.ByteArrayOutputStream
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.rendering.MapCamera
import ru.dndshare.client.maps.rendering.MapSnapshotQueue
import ru.dndshare.client.network.ApiException

data class MapStoredPreview(val url: String, val signature: String, val modelsSignature: String)

/** Preview publication uses the server's signed context; a concurrent edit retries once. */
class MapStoredPreviews(private val api: MapsApi, private val snapshots: MapSnapshotQueue) {
    private val locks = ConcurrentHashMap<String, Mutex>()
    private val ready = ConcurrentHashMap<String, MapStoredPreview>()

    suspend fun ensure(map: BattleMap): MapStoredPreview =
        locks
            .computeIfAbsent(map.id) { Mutex() }
            .withLock {
                require(map.owned) { "Превью обновляет автор карты" }
                if (!map.previewUrl.isNullOrBlank() && !map.previewStale)
                    return@withLock MapStoredPreview(
                        map.previewUrl,
                        map.previewSignature,
                        map.previewModelsSignature,
                    )
                ready[map.id]
                    ?.takeIf { it.signature == map.previewSignature && it.signature.isNotBlank() }
                    ?.let {
                        return@withLock it
                    }
                for (attempt in 0..1) {
                    val context = api.previewContext(map.id)
                    val signature = context.string("signature")
                    require(signature.isNotBlank()) { "Не удалось получить подпись превью" }
                    val existing = context.string("previewUrl")
                    if (existing.isNotBlank())
                        return@withLock MapStoredPreview(
                                existing,
                                signature,
                                context.string("modelsSignature"),
                            )
                            .also { ready[map.id] = it }
                    val document = context.getValue("document").jsonObject
                    val models = context.rows("models").map(::decodeMapModel)
                    val lod =
                        MapCamera()
                            .fit(document.number("width"), document.number("height"), 420, 280)
                            .pixels < 72
                    val image = snapshots.snapshot(document, models, lod = lod, key = signature)
                    val bytes =
                        withContext(Dispatchers.Default) {
                            ByteArrayOutputStream().use { out ->
                                @Suppress("DEPRECATION")
                                val format =
                                    if (Build.VERSION.SDK_INT >= 30)
                                        Bitmap.CompressFormat.WEBP_LOSSY
                                    else Bitmap.CompressFormat.WEBP
                                check(image.compress(format, 88, out)) {
                                    "Не удалось создать WebP-превью"
                                }
                                out.toByteArray().also {
                                    require(it.size <= 1024 * 1024) { "Превью превышает 1 МБ" }
                                }
                            }
                        }
                    try {
                        val result = api.uploadPreview(map.id, signature, bytes)
                        return@withLock MapStoredPreview(
                                result.string("previewUrl"),
                                signature,
                                context.string("modelsSignature"),
                            )
                            .also { ready[map.id] = it }
                    } catch (failure: ApiException) {
                        if (failure.status != 409 || attempt == 1) throw failure
                    }
                }
                error("Не удалось обновить превью")
            }
}
