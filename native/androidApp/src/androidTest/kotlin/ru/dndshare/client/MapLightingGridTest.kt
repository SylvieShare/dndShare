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
import kotlin.math.abs
import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

/** Panning an orthographic camera cannot change illumination of the same world-space points. */
class MapLightingGridTest {
    @Test
    fun punctualLightingDoesNotAcquireScreenAlignedCellsAfterPanOrPicking() = runLighting(false)

    @Test fun punctualShadowsDoNotAcquireScreenAlignedCellsAfterPanOrPicking() = runLighting(true)

    private fun runLighting(shadows: Boolean) {
        val test = InstrumentationRegistry.getInstrumentation()
        val bytes = test.context.assets.open("maps/box-shadow-floor.glb").use { it.readBytes() }
        val api =
            object : UnusedMapsApi() {
                override suspend fun modelBytes(url: String) = bytes
            }
        val folder = File(test.targetContext.cacheDir, "lighting-grid-${System.nanoTime()}")
        val model = MapModel("floor", "floor", "Пол", tileType = "object", renderUrl = "/floor")
        val lights =
            (0..3).map { index ->
                buildJsonObject {
                    put("id", "light-$index")
                    put("x", if (index % 2 == 0) 2 else 6)
                    put("y", if (index < 2) 2 else 6)
                    put("elevation", 0)
                    put("height", 1.5)
                    put("radius", 2.5)
                    put("intensity", 2 * (index + 1))
                    put("color", "#ffffff")
                    put("enabled", true)
                    put("flicker", false)
                    put("shadows", shadows)
                }
            }
        val doc =
            newMapDocument()
                .with("width", JsonPrimitive(8))
                .with("height", JsonPrimitive(8))
                .with("grid", buildJsonObject { put("visible", false) })
                .with("lightingEnabled", JsonPrimitive(true))
                .with("sun", buildJsonObject { put("enabled", false) })
                .with(
                    "objects",
                    JsonArray(
                        listOf(
                            buildJsonObject {
                                put("id", "floor")
                                put("modelId", "floor")
                                put("x", 4)
                                put("y", 4)
                                put("elevation", 0)
                                put("rotation", 0)
                                put("scale", 1)
                            }
                        )
                    ),
                )
                .with("lights", JsonArray(lights))
        val scene = AtomicReference<FilamentMapScene>()
        val error = AtomicReference<String>()
        val camera =
            MapCamera(x = 4.0, y = 4.0, elevation = 0.0, tilt = 90.0, azimuth = 0.0, pixels = 60.0)
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
                                    tag = renderer
                                    renderer.options(
                                        MapSceneOptions(
                                            animate = false,
                                            automaticLod = false,
                                            streamAssets = false,
                                        )
                                    )
                                    renderer.camera(camera)
                                    renderer.update(doc, listOf(model))
                                }
                            },
                            onRelease = { (it.tag as FilamentMapScene).close() },
                        )
                    }
                }
                await {
                    check(error.get() == null) { error.get().orEmpty() }
                    scene.get()?.let {
                        it.hasMapFrame &&
                            model.renderUrl in it.readyModelUrls &&
                            it.effectStatistics.flames == 0
                    } == true
                }
                val renderer = scene.get()
                val before = capture(renderer)
                exportMapTestImage("lighting-grid-before.png", before)
                fun sample(image: Bitmap, pose: MapCamera): List<Int> =
                    (0..20).flatMap { y ->
                        (0..20).map { x ->
                            val p =
                                pose.project(
                                    MapPose(2.0 + x * .2, 2.0 + y * .2, .01),
                                    renderer.width,
                                    renderer.height,
                                )
                            image.getPixel(
                                (p.first * image.width / renderer.width).toInt(),
                                (p.second * image.height / renderer.height).toInt(),
                            )
                        }
                    }
                val base = sample(before, camera)
                assertTrue(
                    base.count { (it shr 16 and 255) > 40 } > 100,
                    "Fixture must have lit pixels",
                )
                var largest = 0
                for (step in 1..6) {
                    val pose = camera.copy(x = 4.0 + step / 6.0)
                    renderer.camera(pose)
                    val image = capture(renderer)
                    val current = sample(image, pose)
                    val changed =
                        base.indices.count { index ->
                            listOf(0, 8, 16).maxOf {
                                abs(
                                    ((base[index] shr it) and 255) -
                                        ((current[index] shr it) and 255)
                                )
                            } > 10
                        }
                    largest = maxOf(largest, changed)
                    if (step == 3) {
                        exportMapTestImage("lighting-grid-pan.png", image)
                        val picked = CountDownLatch(1)
                        renderer.pick(renderer.width / 2f, renderer.height / 2f) {
                            picked.countDown()
                        }
                        assertTrue(picked.await(5, TimeUnit.SECONDS))
                    }
                    image.recycle()
                }
                assertTrue(
                    largest < 20,
                    "Static world lighting must not jump between froxel cells while panning: $largest/${base.size}",
                )
                android.util.Log.i(
                    "MapLightingGridTest",
                    "shadows=$shadows changed=$largest/${base.size}",
                )
                assertNull(error.get())
                before.recycle()
            }
        } finally {
            kotlinx.coroutines.runBlocking {
                kotlinx.coroutines.withTimeout(10000) { scene.get()?.termination?.await() }
            }
            folder.deleteRecursively()
        }
    }

    private fun capture(scene: FilamentMapScene): Bitmap {
        val value = AtomicReference<Result<Bitmap>>()
        val done = CountDownLatch(1)
        scene.snapshot {
            value.set(it)
            done.countDown()
        }
        assertTrue(done.await(12, TimeUnit.SECONDS))
        return value.get().getOrThrow()
    }

    private fun await(condition: () -> Boolean) {
        val until = System.currentTimeMillis() + 20000
        while (System.currentTimeMillis() < until) {
            if (condition()) return
            Thread.sleep(30)
        }
        error("Lighting grid fixture did not settle")
    }
}
