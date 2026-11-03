package ru.dndshare.client

import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.io.IOException
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.*
import kotlinx.coroutines.*
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

class MapSnapshotTest {
    @Test
    fun offscreenQueueRendersWithoutAnActivityAndCachesByPoseAndFrameSize() = runBlocking<Unit> {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val bytes = instrumentation.context.assets.open("maps/box.glb").use { it.readBytes() }
        val requests = AtomicInteger()
        val api =
            object : UnusedMapsApi() {
                override suspend fun modelBytes(url: String): ByteArray {
                    requests.incrementAndGet()
                    return bytes
                }
            }
        val folder = File(context.cacheDir, "map-snapshot-${System.nanoTime()}")
        val queue = MapSnapshotQueue(context, MapAssetCache(folder, api))
        val model =
            MapModel(
                "cube",
                "cube",
                "Куб",
                tileType = "floor",
                renderUrl = "/api/maps/models/cube/render",
            )
        val tile = buildJsonObject {
            put("id", "one")
            put("modelId", "cube")
            put("x", 2)
            put("y", 2)
            put("level", 0)
            put("rotation", 0)
        }
        val doc =
            newMapDocument()
                .with("width", JsonPrimitive(6))
                .with("height", JsonPrimitive(6))
                .with("tiles", JsonArray(listOf(tile)))
        try {
            withTimeout(40_000) {
                val image = queue.snapshot(doc, listOf(model))
                assertEquals(420, image.width)
                assertEquals(280, image.height)
                val pixels = IntArray(image.width * image.height)
                image.getPixels(pixels, 0, image.width, 0, 0, image.width, image.height)
                assertTrue(
                    pixels.distinct().size > 50,
                    "Offscreen GLB must have visible geometry and lighting",
                )
                assertSame(image, queue.snapshot(doc, listOf(model)))
                val taller =
                    queue.snapshot(
                        doc,
                        listOf(model),
                        width = 420,
                        height = 420,
                        key = "server-signature",
                    )
                val narrow =
                    queue.snapshot(
                        doc,
                        listOf(model),
                        width = 280,
                        height = 280,
                        key = "server-signature",
                    )
                assertEquals(420, taller.height)
                assertEquals(280, narrow.height)
                val focused =
                    queue.snapshot(
                        doc,
                        listOf(model),
                        focus = setOf(MapEntityRef(MapEntityKind.Tile, "one")),
                    )
                assertNotSame(image, focused)
            val visible=IntArray(focused.width*focused.height);focused.getPixels(visible,0,focused.width,0,0,focused.width,focused.height)
            assertTrue(visible.count {it!=visible[0]}>1000,"Focused preview must render model geometry without a ground plane")
                assertEquals(
                    1,
                    requests.get(),
                    "Pooled snapshots must retain uploaded GLB resources",
                )
            }
        } finally {
            queue.close()
            folder.deleteRecursively()
        }
    }

    @Test
    fun closingTheQueueCancelsAnOutstandingDownloadWithoutWaitingForItsTimeout() = runBlocking<Unit> {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val entered = CompletableDeferred<Unit>()
        val finish = CompletableDeferred<Unit>()
        val api =
            object : UnusedMapsApi() {
                override suspend fun modelBytes(url: String): ByteArray {
                    entered.complete(Unit)
                    finish.await()
                    return ByteArray(0)
                }
            }
        val folder = File(context.cacheDir, "map-snapshot-cancel-${System.nanoTime()}")
        val queue = MapSnapshotQueue(context, MapAssetCache(folder, api))
        val model =
            MapModel(
                "cube",
                "cube",
                "Куб",
                tileType = "floor",
                renderUrl = "/api/maps/models/cube/render",
            )
        val doc =
            newMapDocument()
                .with(
                    "tiles",
                    JsonArray(
                        listOf(
                            buildJsonObject {
                                put("id", "one")
                                put("modelId", "cube")
                                put("x", 2)
                                put("y", 2)
                                put("rotation", 0)
                                put("level", 0)
                            }
                        )
                    ),
                )
        try {
            withTimeout(10_000) {
                val pending = async { queue.snapshot(doc, listOf(model)) }
                entered.await()
                queue.close()
                assertFailsWith<CancellationException> { withTimeout(3000) { pending.await() } }
            }
        } finally {
            finish.complete(Unit)
            queue.close()
            folder.deleteRecursively()
        }
    }

    @Test
    fun failedAssetDoesNotPublishAPartialImageAndASecondJobCanRecover() = runBlocking<Unit> {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val bytes = instrumentation.context.assets.open("maps/box.glb").use { it.readBytes() }
        var attempts = 0
        val api =
            object : UnusedMapsApi() {
                override suspend fun modelBytes(url: String): ByteArray {
                    if (attempts++ == 0) throw IOException("Нет модели")
                    return bytes
                }
            }
        val folder = File(context.cacheDir, "map-snapshot-retry-${System.nanoTime()}")
        val queue = MapSnapshotQueue(context, MapAssetCache(folder, api))
        val model =
            MapModel(
                "cube",
                "cube",
                "Куб",
                tileType = "floor",
                renderUrl = "/api/maps/models/cube/render",
            )
        val doc =
            newMapDocument()
                .with(
                    "tiles",
                    JsonArray(
                        listOf(
                            buildJsonObject {
                                put("id", "one")
                                put("modelId", "cube")
                                put("x", 2)
                                put("y", 2)
                                put("rotation", 0)
                                put("level", 0)
                            }
                        )
                    ),
                )
        try {
            withTimeout(40_000) {
                assertFailsWith<IllegalStateException> { queue.snapshot(doc, listOf(model)) }
                assertEquals(420, queue.snapshot(doc, listOf(model)).width)
                assertEquals(2, attempts)
            }
        } finally {
            queue.close()
            folder.deleteRecursively()
        }
    }
}
