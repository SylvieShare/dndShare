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
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

class MapPerformanceRendererTest {
    @Test
    fun measurementsAreOptionalPollingDoesNotRenderAndGlobalLodPreservesSelection() {
        val test = InstrumentationRegistry.getInstrumentation()
        val settings = MapRenderSettings.get(test.targetContext)
        runBlocking { settings.ready() }
        val original = settings.forceLod.value
        settings.setForceLod(false)
        val full = test.context.assets.open("maps/box.glb").use { it.readBytes() }
        val low = test.context.assets.open("maps/box-lod-green.glb").use { it.readBytes() }
        val api =
            object : UnusedMapsApi() {
                override suspend fun modelBytes(url: String) = if (url == "/lod") low else full
            }
        val folder = File(test.targetContext.cacheDir, "performance-gpu-${System.nanoTime()}")
        val model = MapModel("box", "box", "Куб", renderUrl = "/render", lodUrl = "/lod")
        val ref = MapEntityRef(MapEntityKind.Tile, "box")
        val doc =
            newMapDocument()
                .with("width", JsonPrimitive(4))
                .with("height", JsonPrimitive(4))
                .with("grid", buildJsonObject { put("visible", false) })
                .with(
                    "tiles",
                    JsonArray(
                        listOf(
                            buildJsonObject {
                                put("id", ref.id)
                                put("modelId", model.uuid)
                                put("x", 1)
                                put("y", 1)
                                put("rotation", 0)
                                put("level", 0)
                            }
                        )
                    ),
                )
        val scene = AtomicReference<FilamentMapScene>()
        val error = AtomicReference<String>()
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
                activity.onActivity { host ->
                    host.setContent {
                        AndroidView(
                            modifier = Modifier.fillMaxSize(),
                            factory = { context ->
                                SurfaceView(context).apply {
                                    val renderer =
                                        FilamentMapScene(this, MapAssetCache(folder, api)) {
                                            _,
                                            failure ->
                                            if (failure != null) error.set(failure)
                                        }
                                    scene.set(renderer)
                                    renderer.options(
                                        MapSceneOptions(
                                            animate = false,
                                            automaticLod = false,
                                            selected = setOf(ref),
                                        )
                                    )
                                    renderer.update(doc, listOf(model))
                                }
                            },
                            onRelease = { scene.get()?.close() },
                        )
                    }
                }
                await { scene.get()?.readyModelUrls?.contains(model.renderUrl) == true }
                val renderer = scene.get()
                renderer.camera(MapCamera(x = 1.5, y = 1.5, pixels = 80.0))
                capture(renderer).recycle()
                val disabled = performance(renderer)
                assertFalse(disabled.enabled)
                assertTrue(disabled.cpu.isEmpty())
                renderer.measurePerformance(true)
                capture(renderer).recycle()
                val measured = performance(renderer)
                assertTrue(measured.enabled)
                assertEquals(60, measured.history.size)
                assertTrue(measured.cpu.values.sum() > 0)
                assertTrue(measured.cpu.containsKey("outlines"))
                Thread.sleep(200)
                val idle = renderer.renderedFrames
                repeat(4) {
                    performance(renderer)
                    Thread.sleep(50)
                }
                assertEquals(
                    idle,
                    renderer.renderedFrames,
                    "Reading the panel must not draw extra frames",
                )
                settings.setForceLod(true)
                await {
                    model.lodUrl in renderer.readyModelUrls &&
                        model.renderUrl !in renderer.readyModelUrls
                }
                val image = capture(renderer)
                val pixels = IntArray(image.width * image.height)
                image.getPixels(pixels, 0, image.width, 0, 0, image.width, image.height)
                assertTrue(pixels.count { ((it shr 8) and 255) > ((it shr 16) and 255) + 10 } > 200)
                assertTrue(
                    pixels.count {
                        (it and 255) > ((it shr 8) and 255) + 12 &&
                            ((it shr 16) and 255) > ((it shr 8) and 255) + 5
                    } > 30,
                    "The LOD preference must preserve selection options",
                )
                exportMapTestImage("performance-lod-selected.png", image)
                renderer.measurePerformance(false)
                val paused = performance(renderer)
                assertFalse(paused.enabled)
                val pausedCpu = paused.cpu
                renderer.camera(renderer.camera().pan(10.0, 0.0))
                capture(renderer).recycle()
                assertEquals(
                    pausedCpu,
                    performance(renderer).cpu,
                    "Disabled collection must retain its last CPU sample",
                )
                renderer.foreground(false)
                renderer.measurePerformance(true)
                assertFalse(performance(renderer).enabled)
                assertNull(error.get())
            }
        } finally {
            settings.setForceLod(original)
            folder.deleteRecursively()
        }
    }

    private fun performance(scene: FilamentMapScene): MapRenderTelemetry {
        val result = AtomicReference<MapRenderTelemetry>()
        val done = CountDownLatch(1)
        scene.performance {
            result.set(it)
            done.countDown()
        }
        assertTrue(done.await(8, TimeUnit.SECONDS))
        return result.get()
    }

    private fun capture(scene: FilamentMapScene): Bitmap {
        val result = AtomicReference<Result<Bitmap>>()
        val done = CountDownLatch(1)
        scene.snapshot {
            result.set(it)
            done.countDown()
        }
        assertTrue(done.await(10, TimeUnit.SECONDS))
        return result.get().getOrThrow()
    }

    private fun await(condition: () -> Boolean) {
        val until = System.currentTimeMillis() + 20000
        while (System.currentTimeMillis() < until) {
            if (condition()) return
            Thread.sleep(30)
        }
        error("Performance renderer did not settle")
    }
}
