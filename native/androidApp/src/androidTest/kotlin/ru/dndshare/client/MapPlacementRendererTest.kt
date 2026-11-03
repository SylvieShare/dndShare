package ru.dndshare.client

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
import kotlin.test.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

class MapPlacementRendererTest {
    @Test
    fun previewLiftsMovesLandsUnderCommittedIdAndCancellationRetiresWithItsLight() =
        runBlocking<Unit> {
            val test = InstrumentationRegistry.getInstrumentation()
            fun shell(command: String) =
                ParcelFileDescriptor.AutoCloseInputStream(
                        test.uiAutomation.executeShellCommand(command)
                    )
                    .use { it.readBytes().decodeToString().trim() }
            val scale = shell("settings get global animator_duration_scale")
            shell("settings put global animator_duration_scale 1")
            val folder = File(test.targetContext.cacheDir, "placement-render-${System.nanoTime()}")
            val bytes = test.context.assets.open("maps/box.glb").use { it.readBytes() }
            val api =
                object : UnusedMapsApi() {
                    override suspend fun modelBytes(url: String) = bytes
                }
            val owner = AtomicReference<FilamentMapScene>()
            val failure = AtomicReference<String>()
            val fake = MapEntityRef(MapEntityKind.Tile, "preview")
            val real = MapEntityRef(MapEntityKind.Tile, "real")
            val model =
                MapModel("floor", "floor", "Пол", surfaceHeight = 0.0, renderUrl = "/floor.glb")
            fun doc(id: String, x: Double) =
                newMapDocument()
                    .with("width", JsonPrimitive(6))
                    .with("height", JsonPrimitive(6))
                    .with(
                        "tiles",
                        JsonArray(
                            listOf(
                                buildJsonObject {
                                    put("id", id)
                                    put("modelId", "floor")
                                    put("x", x)
                                    put("y", 2)
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
                                    put("id", "lamp")
                                    put("enabled", true)
                                    put("height", 1)
                                    put("radius", 5)
                                    put("intensity", 8)
                                    put("flicker", false)
                                    put(
                                        "anchor",
                                        buildJsonObject {
                                            put("kind", "tile")
                                            put("id", id)
                                        },
                                    )
                                    put("offset", numbers(0.0, 0.0))
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
                                factory = { context ->
                                    SurfaceView(context).apply {
                                        val scene =
                                            FilamentMapScene(this, MapAssetCache(folder, api)) {
                                                _,
                                                error ->
                                                if (error != null) failure.set(error)
                                            }
                                        owner.set(scene)
                                        scene.options(
                                            MapSceneOptions(
                                                animate = true,
                                                automaticLod = false,
                                                preview = MapPreviewSpec(setOf(fake)),
                                            )
                                        )
                                        scene.camera(MapCamera(x = 3.0, y = 3.0, pixels = 60.0))
                                        scene.update(doc("preview", 1.0), listOf(model))
                                    }
                                },
                                onRelease = { owner.get()?.close() },
                            )
                        }
                    }
                    await { owner.get()?.readyRefs?.contains(fake) == true }
                    val renderer = owner.get()
                    awaitLight(renderer, "initial lift") { (it?.elevation ?: 0.0) > 1.2 }
                    renderer.update(doc("preview", 4.0), listOf(model))
                    awaitLight(renderer, "horizontal motion") {
                        it?.x?.let { x -> x > 1.7 && x < 4.4 } == true
                    }
                    renderer.options(MapSceneOptions(animate = true, automaticLod = false))
                    renderer.update(doc("real", 4.0), listOf(model))
                    await { real in renderer.readyRefs }
                    awaitLight(renderer, "committed landing") {
                        it?.let { p -> p.x > 4.49 && p.elevation < 1.001 } == true
                    }
                    renderer.options(
                        MapSceneOptions(
                            animate = true,
                            automaticLod = false,
                            preview = MapPreviewSpec(setOf(real)),
                        )
                    )
                    awaitLight(renderer, "second lift") { (it?.elevation ?: 0.0) > 1.2 }
                    renderer.options(MapSceneOptions(animate = true, automaticLod = false))
                    renderer.update(newMapDocument(), listOf(model))
                    val capture = CompletableDeferred<Unit>()
                    renderer.snapshot { result ->
                        result.getOrThrow().recycle()
                        capture.complete(Unit)
                    }
                    withTimeout(5000) { capture.await() }
                    assertTrue(
                        real in renderer.readyRefs,
                        "Cancellation must retain the ready model during its fade",
                    )
                    await { renderer.readyRefs.isEmpty() }
                    delay(150)
                    val frames = renderer.renderedFrames
                    delay(200)
                    assertEquals(frames, renderer.renderedFrames)
                    assertNull(failure.get())
                }
                withTimeout(5000) { owner.get().termination.await() }
            } finally {
                shell("settings put global animator_duration_scale $scale")
                folder.deleteRecursively()
            }
        }

    private suspend fun await(condition: () -> Boolean) =
        withTimeout(20000) { while (!condition()) delay(20) }

    private suspend fun awaitLight(
        renderer: FilamentMapScene,
        stage: String,
        condition: (MapPose?) -> Boolean,
    ) {
        try {
            withTimeout(5000) { renderer.lightPositions.first { condition(it["lamp"]) } }
        } catch (failure: TimeoutCancellationException) {
            error(
                "$stage: ${renderer.lightPositions.value}; ready=${renderer.readyRefs}; frames=${renderer.renderedFrames}"
            )
        }
    }
}
