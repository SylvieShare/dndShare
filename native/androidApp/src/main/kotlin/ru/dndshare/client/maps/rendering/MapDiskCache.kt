package ru.dndshare.client.maps.rendering

import java.io.File
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext

/** GLB and media share one disk budget; reopening an Activity cannot race an older cache writer. */
internal class MapDiskCache(
    private val directory: File,
    private val budget: Long = 384L * 1024 * 1024,
) {
    private val downloads = Semaphore(3)
    private val path = directory.absoluteFile.normalize().path
    private val directoryLock = directories[(path.hashCode() and Int.MAX_VALUE) % directories.size]

    suspend fun read(
        url: String,
        extension: String,
        valid: (ByteArray) -> Boolean = { true },
        request: suspend () -> ByteArray,
    ): ByteArray =
        withContext(Dispatchers.IO) {
            require(extension in setOf("glb", "image"))
            val hash =
                MessageDigest.getInstance("SHA-256").digest(url.toByteArray()).joinToString("") {
                    "%02x".format(it)
                }
            val file = File(directory, "$hash.$extension")
            files[(("$path/$hash.$extension").hashCode() and Int.MAX_VALUE) % files.size].withLock {
                val cached = directoryLock.withLock {
                    directory.mkdirs()
                    directory
                        .listFiles()
                        .orEmpty()
                        .filter {
                            it.extension == "part" &&
                                (it.name.startsWith("map-asset-") ||
                                    it.name.startsWith("map-model-") ||
                                    it.name.startsWith("map-image-"))
                        }
                        .forEach { it.delete() }
                    if (!file.isFile) null
                    else {
                        val bytes = file.readBytes()
                        if (valid(bytes)) {
                            file.setLastModified(System.currentTimeMillis())
                            trim(file)
                            bytes
                        } else {
                            file.delete()
                            null
                        }
                    }
                }
                if (cached != null) return@withLock cached
                val bytes = downloads.withPermit { request() }
                require(valid(bytes)) { "Сервер вернул некорректную GLB-модель" }
                if (bytes.size <= budget)
                    directoryLock.withLock {
                        val temporary = File.createTempFile("map-asset-", ".part", directory)
                        try {
                            temporary.writeBytes(bytes)
                            check(temporary.renameTo(file)) {
                                "Не удалось сохранить ресурс карты на устройстве"
                            }
                        } finally {
                            temporary.delete()
                        }
                        trim(file)
                    }
                bytes
            }
        }

    private fun trim(keep: File?) {
        val records =
            directory.listFiles().orEmpty().filter { it.extension in setOf("glb", "image") }
        var total = records.sumOf { it.length() }
        val protected = keep?.takeIf { it.length() <= budget }
        for (old in records.filter { it != protected }.sortedBy { it.lastModified() }) {
            if (total <= budget) break
            val size = old.length()
            if (old.delete()) total -= size
        }
    }

    companion object {
        private val directories = Array(32) { Mutex() }
        private val files = Array(2048) { Mutex() }
    }
}
