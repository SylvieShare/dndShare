package ru.dndshare.client

import android.graphics.Bitmap
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy
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
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

class MapRendererTest {
    @Test
    fun glbInstancesRenderPickAndStopDrawingWhenIdle() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val bytes =
            InstrumentationRegistry.getInstrumentation()
                .context
                .assets
                .open("maps/box-meshopt.glb")
                .use {
                    it.readBytes()
                }
        val api =
            object : UnusedMapsApi() {
                override suspend fun modelBytes(url: String) = bytes
            }
        val folder = File(context.cacheDir, "map-renderer-test-${System.nanoTime()}")
        val model = MapModel("box", "box", "Куб", renderUrl = "/api/maps/models/box/render")
        val document =
            newMapDocument()
                .with("width", JsonPrimitive(4))
                .with("height", JsonPrimitive(4))
                .with(
                    "tiles",
                    JsonArray(
                        (1..2).map { column ->
                            buildJsonObject {
                                put("id", "placed-$column")
                                put("modelId", "box")
                                put("x", column)
                                put("y", 1)
                                put("rotation", 0)
                                put("level", 0)
                                if (column == 2) put("mirrored", true)
                            }
                        }
                    ),
                )
        val scene = AtomicReference<FilamentMapScene>()
        val texture = AtomicReference<SurfaceView>()
        val errors = AtomicReference<String>()
        ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
            activity.onActivity { host ->
                host.setContent {
                    AndroidView(
                        modifier = Modifier.fillMaxSize(),
                        factory = { viewContext ->
                            SurfaceView(viewContext).also { surface ->
                                texture.set(surface)
                                val renderer =
                                    FilamentMapScene(surface, MapAssetCache(folder, api)) { _, error
                                        ->
                                        if (error != null) errors.set(error)
                                    }
                                scene.set(renderer)
                                surface.addOnLayoutChangeListener {
                                    _,
                                    left,
                                    top,
                                    right,
                                    bottom,
                                    _,
                                    _,
                                    _,
                                    _ ->
                                    renderer.camera(
                                        MapCamera().fit(4.0, 4.0, right - left, bottom - top)
                                    )
                                }
                                renderer.update(document, listOf(model))
                            }
                        },
                        onRelease = { scene.get().close() },
                    )
                }
            }
            await {
                var ready = false
                activity.onActivity { ready = scene.get()?.readyModelUrls?.isNotEmpty() == true }
                ready || errors.get() != null
            }
            assertNull(errors.get())
            await { scene.get().renderedFrames > 0 }
            val picked = AtomicReference<String>()
            activity.onActivity {
                val renderer = scene.get()
                val point =
                    renderer
                        .camera()
                        .project(MapPose(1.5, 1.5, .5), renderer.width, renderer.height)
                renderer.pick(point.first, point.second) { picked.set(it ?: "empty") }
            }
            await { picked.get() != null }
            assertEquals("placed-1", picked.get())
            picked.set(null)
            activity.onActivity {
                val renderer = scene.get()
                val point =
                    renderer
                        .camera()
                        .project(MapPose(2.5, 1.5, .5), renderer.width, renderer.height)
                renderer.pick(point.first, point.second) { picked.set(it ?: "empty") }
            }
            await { picked.get() != null }
            assertEquals("placed-2", picked.get())
            val surfaceHit = AtomicReference<MapSurfaceHit>()
            activity.onActivity {
                val renderer = scene.get()
                val point =
                    renderer
                        .camera()
                        .project(MapPose(1.5, 1.5, .5), renderer.width, renderer.height)
                renderer.pickSurface(point.first, point.second) { surfaceHit.set(it) }
            }
            await { surfaceHit.get() != null || errors.get() != null }
            assertNull(errors.get())
            assertEquals("placed-1", surfaceHit.get().id)
            assertEquals(.5f, surfaceHit.get().world.y, .001f)
            assertTrue(surfaceHit.get().normal.y > .99f)
            var first = 0L
            activity.onActivity { first = scene.get().renderedFrames }
            Thread.sleep(400)
            var settled = 0L
            activity.onActivity { settled = scene.get().renderedFrames }
            Thread.sleep(300)
            activity.onActivity {
                assertEquals(settled, scene.get().renderedFrames)
                assertTrue(settled >= first)
            }
            activity.onActivity {
                scene.get().foreground(false)
                scene.get().requestFrame()
            }
            Thread.sleep(200)
            activity.onActivity {
                assertEquals(settled, scene.get().renderedFrames)
                scene.get().foreground(true)
            }
            await {
                var frames = 0L
                activity.onActivity { frames = scene.get().renderedFrames }
                frames > settled
            }
            val completed = CountDownLatch(1)
            val failure = AtomicReference<Throwable>()
            activity.onActivity {
                scene.get().afterGpuIdle {
                    val view = texture.get()
                    val bitmap =
                        Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
                    PixelCopy.request(
                        view,
                        bitmap,
                        { result ->
                            try {
                                assertEquals(PixelCopy.SUCCESS, result)
                                assertTrue(bitmap.width > 0 && bitmap.height > 0)
                                assertNotEquals(
                                    bitmap.getPixel(bitmap.width / 2, bitmap.height / 2),
                                    bitmap.getPixel(1, 1),
                                    "A GPU image must contain the map",
                                )
                            } catch (error: Throwable) {
                                failure.set(error)
                            } finally {
                                bitmap.recycle()
                                completed.countDown()
                            }
                        },
                        Handler(Looper.getMainLooper()),
                    )
                }
            }

            assertTrue(completed.await(10, TimeUnit.SECONDS))
            failure.get()?.let { throw it }
        }
        folder.deleteRecursively()
    }

    private fun await(condition: () -> Boolean) {
        val deadline = System.currentTimeMillis() + 60_000
        while (System.currentTimeMillis() < deadline) {
            if (condition()) return
            Thread.sleep(50)
        }
        error("Filament did not reach the expected state")
    }
}

internal open class UnusedMapsApi : MapsApi {
    override suspend fun mediaBytes(url: String): ByteArray = error("unused")

    override suspend fun decals(): List<MapDecalImage> = emptyList()

    override suspend fun uploadDecal(
        bytes: ByteArray,
        name: String,
        category: String,
    ): MapDecalImage = error("unused")

    override suspend fun previewContext(id: String): JsonObject = error("unused")

    override suspend fun uploadPreview(
        id: String,
        signature: String,
        bytes: ByteArray,
    ): JsonObject = error("unused")

    override suspend fun updateModel(model: MapModel, data: JsonObject): MapModel = error("unused")

    override suspend fun list(scope: String): List<BattleMap> = error("unused")

    override suspend fun get(id: String): BattleMap = error("unused")

    override suspend fun create(map: BattleMap): BattleMap = error("unused")

    override suspend fun patch(id: String, packet: MapPacket): MapChange = error("unused")

    override suspend fun copy(id: String): BattleMap = error("unused")

    override suspend fun delete(id: String): Unit = error("unused")

    override suspend fun publish(id: String, revision: Long): Unit = error("unused")

    override suspend fun subscribe(id: String, enabled: Boolean): Unit = error("unused")

    override suspend fun rate(id: String, rating: Int): Unit = error("unused")

    override suspend fun models(): List<MapModel> = emptyList()

    override suspend fun modelBytes(url: String): ByteArray = error("unused")
}
