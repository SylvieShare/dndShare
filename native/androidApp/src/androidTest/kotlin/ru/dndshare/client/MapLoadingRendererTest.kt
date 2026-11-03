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
import kotlinx.coroutines.CompletableDeferred
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

class MapLoadingRendererTest {
    @Test
    fun pendingTilesAndObjectsAreVisiblePickableAndReplacedWithoutBlockingTheScene() {
        val test = InstrumentationRegistry.getInstrumentation()
        val bytes = test.context.assets.open("maps/box.glb").use { it.readBytes() }
        val gate = CompletableDeferred<Unit>()
        val api =
            object : UnusedMapsApi() {
                override suspend fun modelBytes(url: String): ByteArray {
                    gate.await()
                    return bytes
                }
            }
        val folder = File(test.targetContext.cacheDir, "loading-gpu-${System.nanoTime()}")
        val model = MapModel("box", "box", "Куб", renderUrl = "/box")
        val tile = MapEntityRef(MapEntityKind.Tile, "same")
        val obj = MapEntityRef(MapEntityKind.Object, "same")
        val document =
            newMapDocument()
                .with("width", JsonPrimitive(8))
                .with("height", JsonPrimitive(6))
                .with("grid", buildJsonObject { put("visible", false) })
                .with(
                    "tiles",
                    JsonArray(
                        listOf(
                            buildJsonObject {
                                put("id", tile.id)
                                put("modelId", "box")
                                put("x", 2)
                                put("y", 2)
                                put("level", 0)
                                put("rotation", 0)
                            }
                        )
                    ),
                )
                .with(
                    "objects",
                    JsonArray(
                        listOf(
                            buildJsonObject {
                                put("id", obj.id)
                                put("modelId", "box")
                                put("x", 5)
                                put("y", 2.5)
                                put("elevation", 0)
                                put("scale", 1)
                                put("rotation", 35)
                            }
                        )
                    ),
                )
        val scene = AtomicReference<FilamentMapScene>()
        val failure = AtomicReference<String>()
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
                                            error ->
                                            if (error != null) failure.set(error)
                                        }
                                    scene.set(renderer)
                                    renderer.options(
                                        MapSceneOptions(animate = false, automaticLod = false)
                                    )
                                    renderer.update(document, listOf(model))
                                }
                            },
                            onRelease = { scene.get()?.close() },
                        )
                    }
                }
                await { scene.get()?.hasMapFrame == true && scene.get().width > 0 }
                val renderer = scene.get()
                val camera = MapCamera(x = 4.0, y = 3.0, tilt = 70.0, azimuth = 0.0, pixels = 60.0)
                renderer.camera(camera)
                val before = capture(renderer)
                exportMapTestImage("loading-gpu-pending.png", before)
                val a = pixels(before)
                assertTrue(
                    a.count {
                        ((it shr 16) and 255) > ((it shr 8) and 255) + 15 &&
                            (it and 255) > ((it shr 16) and 255) + 15
                    } > 300,
                    "Purple checker footprints must be visible",
                )
                assertTrue(renderer.readyRefs.isEmpty())
                for ((ref, pose) in
                    listOf(tile to MapPose(2.5, 2.5, .24), obj to MapPose(5.0, 2.5, .24))) {
                    val (x, y) = camera.project(pose, renderer.width, renderer.height)
                    val found = AtomicReference<MapEntityRef>()
                    val done = CountDownLatch(1)
                    renderer.pick(x, y) {
                        found.set(it)
                        done.countDown()
                    }
                    assertTrue(done.await(8, TimeUnit.SECONDS))
                    assertEquals(ref, found.get(), "Loading entities retain typed picking identity")
                }
                gate.complete(Unit)
                await { renderer.readyRefs == setOf(tile, obj) }
                val after = capture(renderer)
                val b = pixels(after)
                assertTrue(a.indices.count { a[it] != b[it] } > 300)
                assertTrue(
                    b.count {
                        ((it shr 16) and 255) > ((it shr 8) and 255) + 15 &&
                            (it and 255) > ((it shr 16) and 255) + 15
                    } < 40,
                    "Ready GLB must replace all loading planes",
                )
                exportMapTestImage("loading-gpu-ready.png", after)
                assertNull(failure.get())
            }
        } finally {
            gate.complete(Unit)
            folder.deleteRecursively()
        }
    }

    private fun pixels(image: Bitmap) =
        IntArray(image.width * image.height).also {
            image.getPixels(it, 0, image.width, 0, 0, image.width, image.height)
        }

    private fun capture(scene: FilamentMapScene): Bitmap {
        val done = CountDownLatch(1)
        val value = AtomicReference<Result<Bitmap>>()
        scene.snapshot {
            value.set(it)
            done.countDown()
        }
        assertTrue(done.await(10, TimeUnit.SECONDS))
        return value.get().getOrThrow()
    }

    private fun await(condition: () -> Boolean) {
        val end = System.currentTimeMillis() + 15000
        while (System.currentTimeMillis() < end) {
            if (condition()) return
            Thread.sleep(30)
        }
        error("Loading renderer did not settle")
    }
}
