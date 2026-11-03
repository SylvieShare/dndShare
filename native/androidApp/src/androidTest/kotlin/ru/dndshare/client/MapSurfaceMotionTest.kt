package ru.dndshare.client

import android.graphics.Bitmap
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
import kotlin.math.abs
import kotlin.test.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

class MapSurfaceMotionTest {
    @Test
    fun areaVisibilityAndReadyModelReplacementHaveIntermediateFramesAndAnHdrPulse() =
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
            val folder = File(context.cacheDir, "map-surface-motion-${System.nanoTime()}")
            val bytes = test.context.assets.open("maps/box-unlit.glb").use { it.readBytes() }
            val api =
                object : UnusedMapsApi() {
                    override suspend fun modelBytes(url: String) = bytes
                }
            val scene = AtomicReference<FilamentMapScene>()
            val failure = AtomicReference<String>()
            val model =
                MapModel(
                    "box",
                    "box",
                    "Куб",
                    maxHeight = 1.0,
                    renderUrl = "/api/maps/models/box/render",
                )
            val next = model.copy(uuid = "second", id = "second")
            val tile = buildJsonObject {
                put("id", "one")
                put("modelId", "box")
                put("x", 2)
                put("y", 2)
                put("rotation", 0)
                put("level", 0)
            }
            val area = buildJsonObject {
                put("id", "area")
                put("hidden", false)
                put("tileIds", JsonArray(listOf(JsonPrimitive("one"))))
                put("objectIds", JsonArray(emptyList()))
            }
            val doc =
                newMapDocument()
                    .with("width", JsonPrimitive(6))
                    .with("height", JsonPrimitive(6))
                    .with("grid", buildJsonObject { put("visible", false) })
                    .with("tiles", JsonArray(listOf(tile)))
                    .with("areas", JsonArray(listOf(area)))
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
                                            MapSceneOptions(
                                                animate = true,
                                                automaticLod = false,
                                                timeSeconds = 0.0,
                                            )
                                        )
                                        renderer.camera(MapCamera(x = 2.5, y = 2.5, pixels = 90.0))
                                        renderer.update(doc, listOf(model, next))
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
                    suspend fun at(seconds: Double): Bitmap {
                        renderer.options(
                            MapSceneOptions(
                                animate = true,
                                automaticLod = false,
                                timeSeconds = seconds,
                            )
                        )
                        capture(renderer)
                            .recycle() // Apply the timeline and schedule resource preparation.
                        withTimeout(10000) {
                            while (true) {
                                val ready = CompletableDeferred<Boolean>()
                                renderer.resourcesReady { ready.complete(it) }
                                if (ready.await()) break
                                delay(10)
                            }
                        }
                        return capture(renderer)
                    }
                    val full = at(0.0)
                    val original = pixels(full)
                    val background = full.getPixel(0, 0)
                    fun difference(a: Int, b: Int) =
                        listOf(0, 8, 16).sumOf { abs(((a shr it) and 255) - ((b shr it) and 255)) }
                    val roi = original.indices.filter { difference(original[it], background) > 40 }
                    assertTrue(roi.size > 1000)
                    fun energy(image: Bitmap): Long {
                        val values = pixels(image)
                        return roi.sumOf { i ->
                            listOf(0, 8, 16).sumOf { ((values[i] shr it) and 255).toLong() }
                        }
                    }
                    val baseline = energy(full)
                    renderer.update(
                        doc.with(
                            "areas",
                            JsonArray(listOf(area.with("hidden", JsonPrimitive(true)))),
                        ),
                        listOf(model, next),
                    )
                    val hiding = mutableListOf<Bitmap>()
                    for (delta in listOf(0.0, .08, .16, .24, .32, .4, .48, .6)) hiding += at(delta)
                    val faint = at(.7)
                    val faintEnergy = energy(faint)
                    assertTrue(
                        faintEnergy < baseline * .7,
                        "Hidden surface must reach ghost opacity: $faintEnergy/$baseline",
                    )
                    assertTrue(
                        hiding.any {
                            val value = energy(it)
                            value > faintEnergy * 1.15 && value < baseline * .95
                        },
                        "Visibility must pass through intermediate frames: ${hiding.map { energy(it).toDouble()/baseline }}",
                    )
                    val hidePeak = hiding.maxBy(::energy)
                    assertTrue(
                        energy(hidePeak) > baseline * 1.03,
                        "Area visibility must have the web's post-lighting pulse",
                    )
                    exportMapTestImage("surface-hide-pulse.png", hidePeak)
                    exportMapTestImage("surface-hide-final.png", faint)
                    hiding.forEach(Bitmap::recycle)
                    hiding.clear()
                    renderer.update(doc, listOf(model, next))
                    at(.7).recycle()
                    at(1.4).recycle()
                    renderer.update(
                        doc.with(
                            "tiles",
                            JsonArray(listOf(tile.with("modelId", JsonPrimitive("second")))),
                        ),
                        listOf(model, next),
                    )
                    val changing = mutableListOf<Bitmap>()
                    for (delta in listOf(0.0, .08, .16, .24, .32, .4, .48, .6)) changing +=
                        at(1.4 + delta)
                    val peak = changing.maxBy(::energy)
                    assertTrue(
                        energy(peak) > baseline * 1.05,
                        "Ready replacement must pulse without changing the instance's opacity",
                    )
                    exportMapTestImage("surface-replacement-pulse.png", peak)
                    changing.forEach(Bitmap::recycle)
                    changing.clear()
                    val final = at(2.1)
                    assertTrue(
                        abs(energy(final) - baseline) < baseline * .02,
                        "Replacement must settle to the same material: ${energy(final)}/$baseline",
                    )
                    val noFog = pixels(final)
                    val replacementDoc =
                        doc.with(
                            "tiles",
                            JsonArray(listOf(tile.with("modelId", JsonPrimitive("second")))),
                        )
                    renderer.update(
                        replacementDoc.with(
                            "areas",
                            JsonArray(listOf(area.with("fog", JsonPrimitive(true)))),
                        ),
                        listOf(model, next),
                    )
                    val fogFrames = mutableListOf<Bitmap>()
                    for (step in 0..8) fogFrames += at(2.1 + step * .1)
                    val dense = at(3.0)
                    fun delta(image: Bitmap): Long {
                        val values = pixels(image)
                        return values.indices.sumOf { difference(values[it], noFog[it]).toLong() }
                    }
                    val denseDelta = delta(dense)
                    assertTrue(denseDelta > 1000, "Fog must alter the actual GPU image")
                    assertTrue(
                        fogFrames.any {
                            delta(it) > denseDelta * .05 && delta(it) < denseDelta * .85
                        },
                        "Fog must gain density through intermediate frames",
                    )
                    renderer.update(replacementDoc, listOf(model, next))
                    val clearing = mutableListOf<Bitmap>()
                    for (step in 0..8) clearing += at(3.0 + step * .1)
                    val clear = at(3.9)
                    assertFalse(
                        renderer.effectStatistics.fog,
                        "The field must be freed after its last area fades out",
                    )
                    assertTrue(
                        delta(clear) < noFog.size * 4,
                        "The clear view must recover after fog leaves: ${delta(clear)}",
                    )
                    assertTrue(
                        clearing.any {
                            delta(it) > denseDelta * .05 && delta(it) < denseDelta * .85
                        },
                        "Disabling fog must retain the field during its fade: ${clearing.map { delta(it).toDouble() / denseDelta }}",
                    )
                    exportMapTestImage("fog-density-final.png", dense)
                    (fogFrames + clearing + listOf(dense, clear)).forEach(Bitmap::recycle)
                    assertNull(failure.get())
                    (hiding + changing + listOf(full, faint, final)).forEach(Bitmap::recycle)
                }
                withTimeout(5000) { scene.get().termination.await() }
            } finally {
                shell(
                    if (scale == "null") "settings delete global animator_duration_scale"
                    else "settings put global animator_duration_scale $scale"
                )
                folder.deleteRecursively()
            }
        }

    private suspend fun capture(renderer: FilamentMapScene): Bitmap {
        val done = CompletableDeferred<Bitmap>()
        renderer.snapshot { it.fold(done::complete, done::completeExceptionally) }
        return withTimeout(5000) { done.await() }
    }

    private fun pixels(image: Bitmap) =
        IntArray(image.width * image.height).also {
            image.getPixels(it, 0, image.width, 0, 0, image.width, image.height)
        }

    private suspend fun await(condition: () -> Boolean) =
        withTimeout(20000) { while (!condition()) delay(25) }
}
