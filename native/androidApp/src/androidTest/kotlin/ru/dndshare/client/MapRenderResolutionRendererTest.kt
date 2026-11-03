package ru.dndshare.client

import android.content.res.Configuration
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

class MapRenderResolutionRendererTest {
    @Test
    fun aDenseSurfaceKeepsDisplayPickingLogicalLodAndCameraWhenItsBufferIsCapped() {
        val test = InstrumentationRegistry.getInstrumentation()
        val settings = MapRenderSettings.get(test.targetContext)
        runBlocking { settings.ready() }
        val original = settings.forceLod.value
        settings.setForceLod(false)
        val box = test.context.assets.open("maps/box.glb").use { it.readBytes() }
        val low = test.context.assets.open("maps/box-lod-green.glb").use { it.readBytes() }
        val api =
            object : UnusedMapsApi() {
                override suspend fun modelBytes(url: String) = if (url == "/lod") low else box
            }
        val folder = File(test.targetContext.cacheDir, "map-resolution-${System.nanoTime()}")
        val model = MapModel("box", "box", "Куб", renderUrl = "/render", lodUrl = "/lod")
        val ref = MapEntityRef(MapEntityKind.Tile, "tile")
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
                                put("level", 0)
                                put("rotation", 0)
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
                                val config =
                                    Configuration(context.resources.configuration).apply {
                                        densityDpi = 480
                                    }
                                SurfaceView(context.createConfigurationContext(config)).apply {
                                    val renderer =
                                        FilamentMapScene(this, MapAssetCache(folder, api)) {
                                            _,
                                            failure ->
                                            if (failure != null) error.set(failure)
                                        }
                                    scene.set(renderer)
                                    renderer.options(
                                        MapSceneOptions(animate = false, selected = setOf(ref))
                                    )
                                    renderer.update(doc, listOf(model))
                                }
                            },
                            onRelease = { scene.get()?.close() },
                        )
                    }
                }
                await {
                    scene.get()?.let { it.hasMapFrame && it.renderWidth in 1 until it.width } ==
                        true
                }
                val renderer = scene.get()
                assertEquals(3f, renderer.density)
                assertEquals(renderer.width / 2, renderer.renderWidth)
                assertEquals(renderer.height / 2, renderer.renderHeight)
                val pose = MapCamera(x = 1.5, y = 1.5, elevation = .5, pixels = 300.0)
                renderer.camera(pose)
                await { model.renderUrl in renderer.readyModelUrls }
                val image = capture(renderer)
                assertEquals(renderer.renderWidth, image.width)
                assertEquals(renderer.renderHeight, image.height)
                assertEquals(pose, renderer.camera(), "Public camera stays in display coordinates")
                val (x, y) = pose.project(MapPose(1.5, 1.5, .5), renderer.width, renderer.height)
                val picked = AtomicReference<MapEntityRef>()
                val done = CountDownLatch(1)
                renderer.pick(x, y) {
                    picked.set(it)
                    done.countDown()
                }
                assertTrue(done.await(8, TimeUnit.SECONDS))
                assertEquals(ref, picked.get(), "Physical touch must pick the same rendered object")
                val pixels = IntArray(image.width * image.height)
                image.getPixels(pixels, 0, image.width, 0, 0, image.width, image.height)
                assertTrue(
                    pixels.count { ((it shr 16) and 255) > ((it shr 8) and 255) + 10 } > 500,
                    "Logical zoom 100 must use red Render, not green LOD",
                )
                exportMapTestImage("resolution-dense.png", image)
                renderer.fitContents()
                await { renderer.camera() != pose }
                val fitted = renderer.camera()
                val zoomed =
                    fitted.zoom(
                        1.1,
                        renderer.width / 2.0,
                        renderer.height / 2.0,
                        renderer.width,
                        renderer.height,
                        renderer.density.toDouble(),
                    )
                assertTrue(
                    zoomed.pixels >= fitted.pixels,
                    "Zoom after fitting must not jump back to an unscaled limit",
                )
                assertNull(error.get())
            }
        } finally {
            settings.setForceLod(original)
            folder.deleteRecursively()
        }
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
        error("Resolution renderer did not settle")
    }
}
