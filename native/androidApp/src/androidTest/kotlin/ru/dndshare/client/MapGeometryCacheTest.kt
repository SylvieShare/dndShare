package ru.dndshare.client

import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.*
import kotlinx.coroutines.*
import org.junit.Test
import ru.dndshare.client.maps.rendering.*

class MapGeometryCacheTest {
    @Test
    fun slowGeometryCannotBlockAnotherModelAndConcurrentReadersShareOnePreparedResult() =
        runBlocking<Unit> {
            val test = InstrumentationRegistry.getInstrumentation()
            val bytes = test.context.assets.open("maps/review-tile.glb").use { it.readBytes() }
            val root =
                File(test.targetContext.cacheDir, "geometry-concurrency-${System.nanoTime()}")
            val gate = CompletableDeferred<ByteArray>()
            val started = CompletableDeferred<Unit>()
            val requests = AtomicInteger()
            val api =
                object : UnusedMapsApi() {
                    override suspend fun modelBytes(url: String): ByteArray {
                        if (url == "/slow") {
                            requests.incrementAndGet()
                            started.complete(Unit)
                            return gate.await()
                        }
                        return bytes
                    }
                }
            val cache = MapAssetCache(root, api)
            try {
                val first = async(Dispatchers.IO) { cache.geometry("/slow") }
                withTimeout(5000) { started.await() }
                val same = async(Dispatchers.IO) { cache.geometry("/slow") }
                val other = withTimeout(5000) { cache.geometry("/ready") }
                assertTrue(other.second.isNotEmpty())
                gate.complete(bytes)
                assertSame(first.await(), same.await())
                assertEquals(1, requests.get())
            } finally {
                root.deleteRecursively()
            }
        }

    @Test
    fun invalidationEvictsBothDecodedGeometryAndTheCorruptedFile() =
        runBlocking<Unit> {
            val test = InstrumentationRegistry.getInstrumentation()
            var bytes = test.context.assets.open("maps/flat-blue.glb").use { it.readBytes() }
            val root =
                File(test.targetContext.cacheDir, "geometry-invalidation-${System.nanoTime()}")
            val requests = AtomicInteger()
            val api =
                object : UnusedMapsApi() {
                    override suspend fun modelBytes(url: String) = bytes.also {
                        requests.incrementAndGet()
                    }
                }
            val cache = MapAssetCache(root, api)
            try {
                val original = cache.geometry("/model")
                assertSame(original, cache.geometry("/model"))
                bytes = test.context.assets.open("maps/flat-green.glb").use { it.readBytes() }
                cache.invalidate("/model")
                val updated = cache.geometry("/model")
                assertNotEquals(original.first.json, updated.first.json)
                assertEquals(2, requests.get())
            } finally {
                root.deleteRecursively()
            }
        }
}
