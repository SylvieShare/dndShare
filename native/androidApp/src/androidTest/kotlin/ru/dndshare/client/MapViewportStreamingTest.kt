package ru.dndshare.client

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

class MapViewportStreamingTest {
    @Test
    fun cameraLoadsTheVisibleModelAndCancelsADownloadWhenItLeavesTheView() =
        runBlocking<Unit> {
            val test = InstrumentationRegistry.getInstrumentation()
            val context = test.targetContext
            val bytes = test.context.assets.open("maps/box.glb").use { it.readBytes() }
            val farEntered = CompletableDeferred<Unit>()
            val farCancelled = CompletableDeferred<Unit>()
            val nearRequests = AtomicInteger()
            val farRequests = AtomicInteger()
            val api =
                object : UnusedMapsApi() {
                    override suspend fun modelBytes(url: String): ByteArray {
                        if (url.contains("near")) {
                            nearRequests.incrementAndGet()
                            return bytes
                        }
                        farRequests.incrementAndGet()
                        farEntered.complete(Unit)
                        try {
                            awaitCancellation()
                        } finally {
                            farCancelled.complete(Unit)
                        }
                    }
                }
            val folder = File(context.cacheDir, "map-stream-${System.nanoTime()}")
            val scene = AtomicReference<FilamentMapScene>()
            val failure = AtomicReference<String>()
            val near = MapModel("near", "near", "Рядом", renderUrl = "/api/maps/models/near/render")
            val far =
                near.copy(
                    uuid = "far",
                    id = "far",
                    name = "Далеко",
                    renderUrl = "/api/maps/models/far/render",
                )
            val doc =
                newMapDocument()
                    .with("width", JsonPrimitive(200))
                    .with("height", JsonPrimitive(200))
                    .with(
                        "tiles",
                        JsonArray(
                            listOf("near" to 2, "far" to 100).map { (id, x) ->
                                buildJsonObject {
                                    put("id", id)
                                    put("modelId", id)
                                    put("x", x)
                                    put("y", x)
                                    put("rotation", 0)
                                    put("level", 0)
                                }
                            }
                        ),
                    )
            val camera = MapCamera(x = 2.5, y = 2.5, pixels = 70.0)
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
                                                _,
                                                error ->
                                                if (error != null) failure.set(error)
                                            }
                                        scene.set(renderer)
                                        renderer.options(
                                            MapSceneOptions(animate = false, automaticLod = false)
                                        )
                                        renderer.camera(camera)
                                        renderer.update(doc, listOf(near, far))
                                    }
                                },
                                onRelease = { scene.get()?.close() },
                            )
                        }
                    }
                    await {
                        scene
                            .get()
                            ?.readyRefs
                            ?.contains(MapEntityRef(MapEntityKind.Tile, "near")) == true
                    }
                    assertEquals(1, nearRequests.get())
                    assertEquals(0, farRequests.get())
                    scene.get().camera(camera.copy(x = 100.5, y = 100.5))
                    withTimeout(5000) { farEntered.await() }
                    scene.get().camera(camera)
                    withTimeout(5000) { farCancelled.await() }
                    await {
                        scene
                            .get()
                            ?.readyRefs
                            ?.contains(MapEntityRef(MapEntityKind.Tile, "near")) == true
                    }
                    assertEquals(
                        1,
                        nearRequests.get(),
                        "Returning to the viewport must reuse the disk cache",
                    )
                    assertNull(
                        failure.get(),
                        "Cancelling an obsolete download is not a loading error",
                    )
                }
            } finally {
                folder.deleteRecursively()
            }
        }

    private suspend fun await(condition: () -> Boolean) =
        withTimeout(20000) { while (!condition()) delay(25) }
}
