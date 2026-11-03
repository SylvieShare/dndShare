package ru.dndshare.client

import java.io.IOException
import java.nio.file.Files
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.*
import kotlinx.coroutines.*
import org.junit.Test
import ru.dndshare.client.maps.rendering.MapDiskCache

class MapDiskCacheTest {
    @Test
    fun overlappingCacheOwnersShareAnInFlightDownloadAndAnOfflineHit() =
        runBlocking<Unit> {
            val folder = Files.createTempDirectory("map-cache-owners").toFile()
            val calls = AtomicInteger()
            val first = MapDiskCache(folder)
            val second = MapDiskCache(folder)
            try {
                coroutineScope {
                    val a = async {
                        first.read("/decal", "image") {
                            calls.incrementAndGet()
                            delay(40)
                            byteArrayOf(1, 2, 3)
                        }
                    }
                    val b = async {
                        second.read("/decal", "image") {
                            calls.incrementAndGet()
                            delay(40)
                            byteArrayOf(1, 2, 3)
                        }
                    }
                    assertContentEquals(a.await(), b.await())
                }
                assertEquals(1, calls.get())
                assertContentEquals(
                    byteArrayOf(1, 2, 3),
                    MapDiskCache(folder).read("/decal", "image") { throw IOException("offline") },
                )
            } finally {
                folder.deleteRecursively()
            }
        }

    @Test
    fun imagesAndModelsEvictEachOtherWithinTheSameBudget() =
        runBlocking<Unit> {
            val folder = Files.createTempDirectory("map-cache-budget").toFile()
            val cache = MapDiskCache(folder, budget = 12)
            try {
                cache.read("/model", "glb") { ByteArray(8) { 1 } }
                folder.listFiles()!!.single().setLastModified(1)
                cache.read("/decal", "image") { ByteArray(8) { 2 } }
                assertTrue(folder.listFiles()!!.sumOf { it.length() } <= 12)
                assertFailsWith<IOException> {
                    cache.read("/model", "glb") { throw IOException("evicted") }
                }
                assertContentEquals(
                    ByteArray(8) { 2 },
                    cache.read("/decal", "image") { throw IOException("offline") },
                )
                cache.read("/oversized", "image") { ByteArray(16) }
                assertTrue(
                    folder.listFiles()!!.sumOf { it.length() } <= 12,
                    "Oversized media must not expand the disk budget",
                )
            } finally {
                folder.deleteRecursively()
            }
        }
}
