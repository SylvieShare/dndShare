package ru.dndshare.client

import android.graphics.Bitmap
import android.view.SurfaceView
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.*
import kotlinx.coroutines.CompletableDeferred
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

class MapLodRendererTest {
    @Test
    fun upgradingQualityKeepsThePreviousGeometryVisibleWhileTheRenderAssetLoads() =
        qualityFlow(false)

    @Test fun aColdCloseViewShowsLodBeforeItsRenderFileIsReady() = qualityFlow(true)

    private fun qualityFlow(startHigh: Boolean) {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val high = instrumentation.context.assets.open("maps/box.glb").use { it.readBytes() }
        val low =
            instrumentation.context.assets.open("maps/box-lod-green.glb").use { it.readBytes() }
        val entered = CountDownLatch(1)
        val release = CompletableDeferred<Unit>()
        val requestGate = AtomicReference(release)
        val requestEntered = AtomicReference(entered)
        val api =
            object : UnusedMapsApi() {
                override suspend fun modelBytes(url: String): ByteArray {
                    if (url.endsWith("/lod")) return low
                    requestEntered.get().countDown()
                    requestGate.get().await()
                    return high
                }
            }
        val folder = File(context.cacheDir, "map-lod-${System.nanoTime()}")
        val model =
            MapModel(
                "box",
                "box",
                "Куб",
                renderUrl = "/api/maps/models/box/render",
                lodUrl = "/api/maps/models/box/lod",
            )
        val ref = MapEntityRef(MapEntityKind.Tile, "one")
        val doc =
            newMapDocument()
                .with("width", JsonPrimitive(4))
                .with("height", JsonPrimitive(4))
                .with(
                    "tiles",
                    JsonArray(
                        listOf(
                            buildJsonObject {
                                put("id", ref.id)
                                put("modelId", "box")
                                put("x", 1)
                                put("y", 1)
                                put("level", 0)
                                put("rotation", 0)
                            }
                        )
                    ),
                )
        val scene = AtomicReference<FilamentMapScene>()
        val failure = AtomicReference<String>()
        val pending = AtomicInteger(-1)
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
                activity.onActivity { host ->
                    host.setContent {
                        AndroidView(
                            modifier = Modifier.fillMaxSize(),
                            factory = { viewContext ->
                                SurfaceView(viewContext).apply {
                                    val renderer =
                                        FilamentMapScene(this, MapAssetCache(folder, api)) {
                                            count,
                                            error ->
                                            pending.set(count)
                                            if (error != null) failure.set(error)
                                        }
                                    scene.set(renderer)
                                    renderer.options(
                                        MapSceneOptions(forceLod = !startHigh, automaticLod = false)
                                    )
                                    renderer.update(doc, listOf(model))
                                }
                            },
                            onRelease = { scene.get()?.close() },
                        )
                    }
                }
                await { scene.get()?.width?.let { it > 0 } == true }
                val renderer = scene.get()
                renderer.camera(MapCamera().fit(4.0, 4.0, renderer.width, renderer.height))
                if (startHigh) {
                    await { ref in renderer.readyRefs && model.lodUrl in renderer.readyModelUrls }
                    assertTrue(entered.await(5, TimeUnit.SECONDS))
                    assertTrue(model.renderUrl !in renderer.readyModelUrls)
                    assertGreen(capture(renderer))
                } else {
                    await { pending.get() == 0 && ref in renderer.readyRefs }
                    assertGreen(capture(renderer))
                    renderer.options(MapSceneOptions(forceLod = false, automaticLod = false))
                    assertTrue(entered.await(5, TimeUnit.SECONDS))
                    assertGreen(capture(renderer))
                    assertTrue(
                        ref in renderer.readyRefs,
                        "Fallback geometry must stay available to the UI",
                    )
                }
                release.complete(Unit)
                await { pending.get() == 0 }
                val final = capture(renderer)
                val pixels = IntArray(final.width * final.height)
                final.getPixels(pixels, 0, final.width, 0, 0, final.width, final.height)
                assertTrue(
                    pixels.count { ((it shr 16) and 255) > ((it shr 8) and 255) + 8 } > 50,
                    "Render geometry must replace the LOD after loading",
                )
                val growGate = CompletableDeferred<Unit>()
                val growing = CountDownLatch(1)
                requestGate.set(growGate)
                requestEntered.set(growing)
                folder
                    .listFiles()
                    .orEmpty()
                    .filter { it.extension == "glb" }
                    .forEach { assertTrue(it.delete()) }
                val expanded =
                    doc.with(
                        "tiles",
                        JsonArray(
                            doc.rows("tiles") +
                                (0 until 16)
                                    .filter { it != 5 }
                                    .take(8)
                                    .mapIndexed { index, cell ->
                                        buildJsonObject {
                                            put("id", "extra-$index")
                                            put("modelId", "box")
                                            put("x", cell % 4)
                                            put("y", cell / 4)
                                            put("level", 0)
                                            put("rotation", 0)
                                        }
                                    }
                        ),
                    )
                renderer.update(expanded, listOf(model))
                assertTrue(growing.await(5, TimeUnit.SECONDS))
                assertTrue(
                    ref in renderer.readyRefs,
                    "Growing the instance pool must retain its existing objects",
                )
                val retained = capture(renderer)
                val colours = IntArray(retained.width * retained.height)
                retained.getPixels(
                    colours,
                    0,
                    retained.width,
                    0,
                    0,
                    retained.width,
                    retained.height,
                )
                assertTrue(colours.count { ((it shr 16) and 255) > ((it shr 8) and 255) + 8 } > 50)
                retained.recycle()
                growGate.complete(Unit)
                await { pending.get() == 0 && renderer.readyRefs.size == 9 }
                assertNull(failure.get())
            }
        } finally {
            release.complete(Unit)
            requestGate.get().complete(Unit)
            folder.deleteRecursively()
        }
    }

    private fun assertGreen(image: Bitmap) {
        val pixels = IntArray(image.width * image.height)
        image.getPixels(pixels, 0, image.width, 0, 0, image.width, image.height)
        assertTrue(
            pixels.count { ((it shr 8) and 255) > ((it shr 16) and 255) + 8 } > 50,
            "The previous LOD must remain visible",
        )
        image.recycle()
    }

    private fun capture(scene: FilamentMapScene): Bitmap {
        val done = CountDownLatch(1)
        val result = AtomicReference<Result<Bitmap>>()
        scene.snapshot {
            result.set(it)
            done.countDown()
        }
        assertTrue(done.await(10, TimeUnit.SECONDS))
        return result.get().getOrThrow()
    }

    private fun await(condition: () -> Boolean) {
        val until = System.currentTimeMillis() + 15_000
        while (System.currentTimeMillis() < until) {
            if (condition()) return
            Thread.sleep(30)
        }
        error("LOD renderer did not settle")
    }
}
