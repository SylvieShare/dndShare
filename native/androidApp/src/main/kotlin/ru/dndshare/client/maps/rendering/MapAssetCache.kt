package ru.dndshare.client.maps.rendering

import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import ru.dndshare.client.maps.MapBuiltinProps
import ru.dndshare.client.maps.MapsApi
import ru.dndshare.client.maps.geometry.*

/** Content-addressed disk cache; only models actually used on the map are requested. */
class MapAssetCache(private val directory: File, private val api: MapsApi) {
    private val disk = MapDiskCache(directory)
    private val geometryLock = Mutex()
    private val geometry = LinkedHashMap<String, Pair<GlbDocument, List<GlbPart>>>(16, .75f, true)

    suspend fun geometry(url: String): Pair<GlbDocument, List<GlbPart>> =
        withContext(Dispatchers.IO) {
            geometryLock.withLock {
                geometry[url]?.let {
                    return@withLock it
                }
                val parsed = GlbDocument(bytes(url))
                val value = parsed to parsed.parts()
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
                while (used > 96L * 1024 * 1024 && geometry.size > 1 && iterator.hasNext()) {
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
                value
            }
        }

    suspend fun media(url: String): ByteArray = disk.read(url, "image") { api.mediaBytes(url) }

    suspend fun bytes(url: String): ByteArray =
        disk.read(url, "glb", ::validGlb) {
            MapBuiltinProps.bytes(url) ?: api.modelBytes(url)
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
