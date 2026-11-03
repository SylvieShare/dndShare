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
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

class MapLightFrameTest {
    @Test
    fun livePreviewCropsTheMainFrameAndStopsReadingWhenTheSceneIsStatic() =
        runBlocking<Unit> {
            val instrumentation = InstrumentationRegistry.getInstrumentation()
            val context = instrumentation.targetContext
            val bytes = instrumentation.context.assets.open("maps/box.glb").use { it.readBytes() }
            val api =
                object : UnusedMapsApi() {
                    override suspend fun modelBytes(url: String) = bytes
                }
            val folder = File(context.cacheDir, "map-live-${System.nanoTime()}")
            val scene = AtomicReference<FilamentMapScene>()
            val failure = AtomicReference<String>()
            val latest = AtomicReference<MapLightFrame>()
            val images = AtomicInteger()
            val model = MapModel("box", "box", "Куб", renderUrl = "/api/maps/models/box/render")
            val doc =
                newMapDocument()
                    .with("width", JsonPrimitive(6))
                    .with("height", JsonPrimitive(6))
                    .with(
                        "tiles",
                        JsonArray(
                            listOf(
                                buildJsonObject {
                                    put("id", "one")
                                    put("modelId", "box")
                                    put("x", 2)
                                    put("y", 2)
                                    put("rotation", 0)
                                    put("level", 0)
                                }
                            )
                        ),
                    )
                    .with(
                        "lights",
                        JsonArray(
                            listOf(
                                buildJsonObject {
                                    put("id", "light")
                                    put("x", 2.5)
                                    put("y", 2.5)
                                    put("elevation", 0)
                                    put("height", .5)
                                    put("color", "#ffffff")
                                    put("enabled", true)
                                    put("flicker", false)
                                    put("intensity", 8)
                                    put("radius", 5)
                                }
                            )
                        ),
                    )
            try {
                ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
                    activity.onActivity { host ->
                        host.setContent {
                            AndroidView(
                                modifier = Modifier.fillMaxSize(),
                                factory = { viewContext ->
                                    SurfaceView(viewContext).apply {
                                        val value =
                                            FilamentMapScene(this, MapAssetCache(folder, api)) {
                                                _,
                                                error ->
                                                if (error != null) failure.set(error)
                                            }
                                        scene.set(value)
                                        value.options(
                                            MapSceneOptions(animate = false, automaticLod = false)
                                        )
                                        value.update(doc, listOf(model))
                                    }
                                },
                                onRelease = { scene.get()?.close() },
                            )
                        }
                    }
                    await {
                        scene.get()?.readyRefs?.contains(MapEntityRef(MapEntityKind.Tile, "one")) ==
                            true
                    }
                    val renderer = scene.get()
                    val camera = MapCamera(x = 2.5, y = 2.5, pixels = 70.0, elevation = .5)
                    renderer.camera(camera)
                    val subscription =
                        renderer.observeLight("light", 80, 60) {
                            latest.set(it)
                            if (it.image != null) images.incrementAndGet()
                        }
                    try {
                        await { latest.get()?.image != null }
                        assertNull(failure.get())
                        val crop = latest.get().image!!
                        val full = CompletableDeferred<Bitmap>()
                        renderer.snapshot { full.complete(it.getOrThrow()) }
                        val frame = withTimeout(5000) { full.await() }
                        val region =
                            mapLightFrameRegion(
                                camera,
                                MapPose(2.5, 2.5, .5),
                                renderer.width,
                                renderer.height,
                                80,
                                60,
                                renderer.density.toDouble(),
                            )!!
                        assertEquals(region.width, crop.width)
                        assertEquals(region.height, crop.height)
                        val expected = IntArray(crop.width * crop.height)
                        val actual = IntArray(expected.size)
                        frame.getPixels(
                            expected,
                            0,
                            crop.width,
                            region.left,
                            region.top,
                            crop.width,
                            crop.height,
                        )
                        crop.getPixels(actual, 0, crop.width, 0, 0, crop.width, crop.height)
                        // Filament dithers consecutive SDR frames by a code value. Geometry and
                        // crop coordinates must match without requiring identical temporal noise.
                        val difference =
                            expected.indices.map { i ->
                                listOf(0, 8, 16).maxOf { shift ->
                                    kotlin.math.abs(
                                        ((expected[i] shr shift) and 255) -
                                            ((actual[i] shr shift) and 255)
                                    )
                                }
                            }
                        assertTrue(
                            difference.average() < 2.0 &&
                                difference.count { it > 12 } < difference.size / 100,
                            "Main-frame crop mismatch: mean=${difference.average()}, outliers=${difference.count { it > 12 }}",
                        )
                        delay(500)
                        assertEquals(
                            1,
                            images.get(),
                            "Reading a static frame must not drive a recurring render loop",
                        )
                        renderer.camera(camera.copy(x = 100.0))
                        await { latest.get()?.state == "outside" }
                        assertEquals(
                            1,
                            images.get(),
                            "A partial crop must preserve the last complete image",
                        )
                        renderer.camera(camera)
                        await { images.get() == 2 }
                    } finally {
                        subscription.close()
                    }
                }
            } finally {
                folder.deleteRecursively()
            }
        }

    private suspend fun await(condition: () -> Boolean) =
        withTimeout(20000) {
            while (!condition()) delay(25)
        }
}
