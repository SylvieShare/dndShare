package ru.dndshare.client.maps.rendering

import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import ru.dndshare.client.maps.MapBuiltinProps
import ru.dndshare.client.maps.MapModel
import ru.dndshare.client.maps.MapsApi
import ru.dndshare.client.maps.geometry.*

/** Content-addressed disk cache; only models actually used on the map are requested. */
class MapAssetCache(private val directory: File, private val api: MapsApi) {
    val downloads = MapDownloads()
    private val catalogueKey = MapDownloadKey<List<MapModel>>("/api/maps/models")

    suspend fun catalogue(force: Boolean = false): List<MapModel> {
        if (force) downloads.invalidate(catalogueKey)
        return downloads.read(catalogueKey, api::models)
    }

    private val disk = MapDiskCache(directory)
    private val geometryLock = Mutex()
    private val geometry = LinkedHashMap<String, Pair<GlbDocument, List<GlbPart>>>(16, .75f, true)

    private class GeometryLease {
        val mutex = Mutex()
        var users = 0
    }

    private val geometryWork = ConcurrentHashMap<String, GeometryLease>()
    private val geometryCpu = Semaphore(2)
    private val geometryEpoch = AtomicLong()

    suspend fun geometry(url: String): Pair<GlbDocument, List<GlbPart>> =
        withContext(Dispatchers.IO) {
            geometryLock
                .withLock { geometry[url] }
                ?.let {
                    return@withContext it
                }
            val lease =
                requireNotNull(
                    geometryWork.compute(url) { _, current ->
                        (current ?: GeometryLease()).also { it.users++ }
                    }
                )
            try {
                lease.mutex.withLock {
                    geometryLock
                        .withLock { geometry[url] }
                        ?.let {
                            return@withContext it
                        }
                    val epoch = geometryEpoch.get()
                    val bytes = bytes(url, oneAttempt = true)
                    val value = geometryCpu.withPermit {
                        withContext(Dispatchers.Default) {
                            val parsed = GlbDocument(bytes)
                            val parts = parsed.parts()
                            if (parts.isEmpty())
                                throw MapPermanentLoadException("В файле модели нет геометрии")
                            parsed to parts
                        }
                    }
                    geometryLock.withLock {
                        if (epoch == geometryEpoch.get()) {
                            geometry[url] = value
                            var used =
                                geometry.values.sumOf { (source, parts) ->
                                    source.retainedBytes +
                                        parts.sumOf { p ->
                                            (p.geometry.positions.size +
                                                    p.geometry.normals.size +
                                                    p.geometry.uv.size +
                                                    p.geometry.colors.size +
                                                    p.geometry.water.size +
                                                    p.geometry.indices.size)
                                                .toLong() * 4
                                        }
                                }
                            val iterator = geometry.entries.iterator()
                            while (
                                used > 96L * 1024 * 1024 && geometry.size > 1 && iterator.hasNext()
                            ) {
                                val old = iterator.next()
                                used -=
                                    old.value.first.retainedBytes +
                                        old.value.second.sumOf { p ->
                                            (p.geometry.positions.size +
                                                    p.geometry.normals.size +
                                                    p.geometry.uv.size +
                                                    p.geometry.colors.size +
                                                    p.geometry.water.size +
                                                    p.geometry.indices.size)
                                                .toLong() * 4
                                        }
                                iterator.remove()
                            }
                        }
                    }
                    value
                }
            } finally {
                geometryWork.computeIfPresent(url) { _, current ->
                    if (current !== lease) current else if (--current.users == 0) null else current
                }
            }
        }

    suspend fun invalidate(url: String) {
        downloads.invalidate(url)
        geometryEpoch.incrementAndGet()
        geometryWork.remove(url)
        geometryLock.withLock { geometry.remove(url) }
        try {
            disk.evict(url, "glb")
        } finally {
            geometryEpoch.incrementAndGet()
            withContext(NonCancellable) { geometryLock.withLock { geometry.remove(url) } }
        }
    }

    suspend fun invalidateMedia(url: String) {
        downloads.invalidate(url)
        disk.evict(url, "image")
    }

    suspend fun media(url: String, oneAttempt: Boolean = false): ByteArray =
        downloads.read(url, oneAttempt) { progress ->
            disk.read(url, "image") {
                api.mediaBytes(url, progress)
            }
        }

    suspend fun bytes(url: String, oneAttempt: Boolean = false): ByteArray {
        if (url.isBlank()) throw MapPermanentLoadException("У модели не задан файл для отображения")
        return downloads.read(url, oneAttempt) { progress ->
            disk.read(url, "glb", ::validGlb) {
                MapBuiltinProps.bytes(url) ?: api.modelBytes(url, progress)
            }
        }
    }

    private fun validGlb(bytes: ByteArray): Boolean {
        if (bytes.size < 20 || bytes.copyOfRange(0, 4).decodeToString() != "glTF") return false
        val header = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
        return header.getInt(4) == 2 &&
            header.getInt(8) == bytes.size &&
            header.getInt(16) == 0x4e4f534a &&
            header.getInt(12) in 1..(bytes.size - 20)
    }
}
