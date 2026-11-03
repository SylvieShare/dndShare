package ru.dndshare.client

import android.animation.ValueAnimator
import android.os.ParcelFileDescriptor
import android.view.SurfaceView
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.hypot
import kotlin.test.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

class MapSceneMotionTest {
    @Test
    fun aTurningTileMovesItsLightThroughIntermediateFramesAndThenStopsRendering() =
        runBlocking<Unit> {
            val test = InstrumentationRegistry.getInstrumentation()
            fun shell(command: String) =
                ParcelFileDescriptor.AutoCloseInputStream(
                        test.uiAutomation.executeShellCommand(command)
                    )
                    .use { it.readBytes().decodeToString().trim() }
            val scale = shell("settings get global animator_duration_scale")
            shell("settings put global animator_duration_scale 1")
            val context = test.targetContext
            val folder = File(context.cacheDir, "map-motion-${System.nanoTime()}")
            val bytes = test.context.assets.open("maps/box.glb").use { it.readBytes() }
            val api =
                object : UnusedMapsApi() {
                    override suspend fun modelBytes(url: String) = bytes
                }
            val scene = AtomicReference<FilamentMapScene>()
            val failure = AtomicReference<String>()
            val model =
                MapModel(
                    "floor",
                    "floor",
                    "Пол",
                    surfaceHeight = .5,
                    renderUrl = "/api/maps/models/floor/render",
                )
            val tile = buildJsonObject {
                put("id", "tile")
                put("modelId", "floor")
                put("x", 2)
                put("y", 2)
                put("level", 0)
                put("rotation", 0)
            }
            val light = buildJsonObject {
                put("id", "light")
                put("enabled", true)
                put("flicker", false)
                put("height", 1)
                put("radius", 5)
                put("intensity", 8)
                put(
                    "anchor",
                    buildJsonObject {
                        put("kind", "tile")
                        put("id", "tile")
                    },
                )
                put("offset", numbers(.2, 0.0))
            }
            val doc =
                newMapDocument()
                    .with("width", JsonPrimitive(6))
                    .with("height", JsonPrimitive(6))
                    .with("tiles", JsonArray(listOf(tile)))
                    .with("lights", JsonArray(listOf(light)))
            try {
                assertTrue(ValueAnimator.areAnimatorsEnabled())
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
                                            MapSceneOptions(animate = true, automaticLod = false)
                                        )
                                        renderer.camera(MapCamera(x = 2.5, y = 2.5, pixels = 70.0))
                                        renderer.update(doc, listOf(model))
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
                            ?.contains(MapEntityRef(MapEntityKind.Tile, "tile")) == true
                    }
                    val renderer = scene.get()
                    val warmed = CompletableDeferred<Unit>()
                    renderer.snapshot {
                        it.getOrThrow().recycle()
                        warmed.complete(Unit)
                    }
                    withTimeout(5000) { warmed.await() }
                    val intermediate = async {
                        withTimeout(5000) {
                            renderer.lightPositions.first { positions ->
                                positions["light"]?.let {
                                    hypot(it.x - 2.7, it.y - 2.5) > .02 &&
                                        hypot(it.x - 2.5, it.y - 2.7) > .02
                                } == true
                            }
                        }
                    }
                    renderer.update(
                        doc.with(
                            "tiles",
                            JsonArray(listOf(tile.with("rotation", JsonPrimitive(90)))),
                        ),
                        listOf(model),
                    )
                    try {
                        intermediate.await()
                    } catch (failure: TimeoutCancellationException) {
                        error("No intermediate light pose: ${renderer.lightPositions.value}")
                    }
                    withTimeout(5000) {
                        renderer.lightPositions.first { positions ->
                            positions["light"]?.let { hypot(it.x - 2.5, it.y - 2.7) < .001 } == true
                        }
                    }
                    delay(150)
                    val frames = renderer.renderedFrames
                    delay(250)
                    assertEquals(
                        frames,
                        renderer.renderedFrames,
                        "A finished pose must return to on-demand rendering",
                    )
                    assertNull(failure.get())
                }
            } finally {
                shell("settings put global animator_duration_scale $scale")
                folder.deleteRecursively()
            }
        }

    private suspend fun await(condition: () -> Boolean) =
        withTimeout(20000) { while (!condition()) delay(25) }
}
