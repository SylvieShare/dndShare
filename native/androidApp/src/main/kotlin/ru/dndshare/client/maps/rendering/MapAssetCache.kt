package ru.dndshare.client.maps.rendering

import java.io.File
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import ru.dndshare.client.maps.MapsApi
import ru.dndshare.client.maps.geometry.*

/** Content-addressed disk cache; only models actually used on the map are requested. */
class MapAssetCache(private val directory: File, private val api: MapsApi) {
    private val downloads = Semaphore(3)
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
                    geometry.values.sumOf { (_, parts) ->
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

    suspend fun media(url: String) =
        withContext(Dispatchers.IO) {
            directory.mkdirs()
            val hash =
                MessageDigest.getInstance("SHA-256").digest(url.toByteArray()).joinToString("") {
                    "%02x".format(it)
                }
            val file = File(directory, "$hash.image")
            if (file.isFile) file.readBytes()
            else
                api.mediaBytes(url).also { bytes ->
                    File.createTempFile("map-image-", ".part", directory).let { tmp ->
                        try {
                            tmp.writeBytes(bytes)
                            check(tmp.renameTo(file))
                        } finally {
                            tmp.delete()
                        }
                    }
                }
        }

    suspend fun bytes(url: String): ByteArray =
        withContext(Dispatchers.IO) {
            downloads.withPermit {
                directory.mkdirs()
                val key =
                    MessageDigest.getInstance("SHA-256").digest(url.toByteArray()).joinToString(
                        ""
                    ) {
                        "%02x".format(it)
                    }
                val file = File(directory, "$key.glb")
                if (file.isFile) {
                    val bytes = file.readBytes()
                    if (validGlb(bytes)) {
                        file.setLastModified(System.currentTimeMillis())
                        return@withPermit bytes
                    }
                    file.delete()
                }
                val bytes = api.modelBytes(url)
                require(validGlb(bytes)) { "Сервер вернул некорректную GLB-модель" }
                val temporary = File.createTempFile("map-model-", ".part", directory)
                try {
                    temporary.writeBytes(bytes)
                    check(temporary.renameTo(file)) { "Не удалось сохранить модель на устройстве" }
                } finally {
                    temporary.delete()
                }
                var total =
                    directory
                        .listFiles()
                        .orEmpty()
                        .filter { it.extension == "glb" }
                        .sumOf { it.length() }
                for (old in
                    directory
                        .listFiles()
                        .orEmpty()
                        .filter { it.extension == "glb" && it != file }
                        .sortedBy { it.lastModified() }) {
                    if (total <= 384L * 1024 * 1024) break
                    val size = old.length()
                    if (old.delete()) total -= size
                }
                bytes
            }
        }

    private fun validGlb(bytes: ByteArray) =
        bytes.size >= 20 &&
            bytes[0] == 0x67.toByte() &&
            bytes[1] == 0x6c.toByte() &&
            bytes[2] == 0x54.toByte() &&
            bytes[3] == 0x46.toByte()
}
