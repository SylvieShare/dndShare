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
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

class MapSurfaceLayersTest {
    @Test
    fun hiddenGeometryKeepsItsNearestSurfaceIsPickableAndHasASilhouetteOutline() =
        runBlocking<Unit> {
            val instrumentation = InstrumentationRegistry.getInstrumentation()
            val context = instrumentation.targetContext
            val bytes = instrumentation.context.assets.open("maps/box.glb").use { it.readBytes() }
            val api =
                object : UnusedMapsApi() {
                    override suspend fun modelBytes(url: String) =
                        if (url.contains("blend"))
                            instrumentation.context.assets.open("maps/box-water-blend.glb").use {
                                it.readBytes()
                            }
                        else bytes
                }
            val folder = File(context.cacheDir, "map-surfaces-${System.nanoTime()}")
            val scene = AtomicReference<FilamentMapScene>()
            val error = AtomicReference<String>()
            val ref = MapEntityRef(MapEntityKind.Tile, "one")
            val model = MapModel("box", "box", "Куб", renderUrl = "/api/maps/models/box/render")
            val empty =
                newMapDocument()
                    .with("width", JsonPrimitive(6))
                    .with("height", JsonPrimitive(6))
                    .with("grid", buildJsonObject { put("visible", false) })
            val document =
                empty.with(
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
            val hidden =
                document.with(
                    "areas",
                    JsonArray(
                        listOf(
                            buildJsonObject {
                                put("id", "hidden")
                                put("name", "Скрытая область")
                                put("hidden", true)
                                put("tileIds", JsonArray(listOf(JsonPrimitive("one"))))
                                put("objectIds", JsonArray(emptyList()))
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
                                        val renderer =
                                            FilamentMapScene(this, MapAssetCache(folder, api)) {
                                                _,
                                                message ->
                                                if (message != null) error.set(message)
                                            }
                                        scene.set(renderer)
                                        renderer.options(
                                            MapSceneOptions(animate = false, automaticLod = false)
                                        )
                                        renderer.update(empty, listOf(model))
                                    }
                                },
                                onRelease = { scene.get()?.close() },
                            )
                        }
                    }
                    await { scene.get()?.hasMapFrame == true }
                    val renderer = scene.get()
                    val camera = MapCamera(x = 2.5, y = 2.5, pixels = 80.0, elevation = .5)
                    renderer.camera(camera)
                    val background = capture(renderer)
                    renderer.update(document, listOf(model))
                    await { ref in renderer.readyRefs }
                    val opaque = capture(renderer)
                    renderer.update(hidden, listOf(model))
                    val ghost = capture(renderer)
                    assertNull(error.get())
                    exportMapTestImage("surface-opaque.png", opaque)
                    exportMapTestImage("surface-ghost.png", ghost)
                    val a = pixels(background)
                    val b = pixels(opaque)
                    val c = pixels(ghost)
                    fun distance(x: Int, y: Int) =
                        listOf(0, 8, 16).sumOf {
                            kotlin.math.abs(((x shr it) and 255) - ((y shr it) and 255))
                        }
                    val geometry = a.indices.filter { distance(a[it], b[it]) > 40 }
                    val full = geometry.sumOf { distance(a[it], b[it]).toLong() }
                    val faint = geometry.sumOf { distance(a[it], c[it]).toLong() }
                    assertTrue(geometry.size > 1000, "The reference cube must be visible")
                    assertTrue(
                        faint > full * .025 && faint < full * .65,
                        "Ghost must retain the cube's nearest surface at lower opacity: $faint/$full",
                    )
                    val point =
                        camera.project(MapPose(2.5, 2.5, .5), renderer.width, renderer.height)
                    val picked = CompletableDeferred<MapEntityRef?>()
                    renderer.pick(point.first, point.second) { picked.complete(it) }
                    assertEquals(
                        ref,
                        withTimeout(5000) { picked.await() },
                        "Hidden master geometry remains selectable",
                    )
                    renderer.options(
                        MapSceneOptions(
                            animate = false,
                            automaticLod = false,
                            selected = setOf(ref),
                        )
                    )
                    val outlined = capture(renderer)
                    exportMapTestImage("surface-outlined.png", outlined)
                    val o = pixels(outlined)
                    val purple =
                        o.indices.count { i ->
                            val red = (o[i] shr 16) and 255
                            val green = (o[i] shr 8) and 255
                            val blue = o[i] and 255
                            blue > green + 12 && red > green + 5 && distance(o[i], c[i]) > 40
                        }
                    assertTrue(purple > 30, "Selection must outline the model silhouette: $purple")
                    val cachedBuilds = renderer.outlineBuilds
                    repeat(3) { capture(renderer).recycle() }
                    assertEquals(
                        cachedBuilds,
                        renderer.outlineBuilds,
                        "A static selection mask must survive additional frames",
                    )
                    renderer.options(MapSceneOptions(animate = false, automaticLod = false))
                    capture(renderer).recycle()
                    renderer.hover(point.first, point.second)
                    await { renderer.outlineBuilds > cachedBuilds }
                    val hovered = capture(renderer)
                    exportMapTestImage("surface-hovered.png", hovered)
                    val hp = pixels(hovered)
                    assertTrue(
                        hp.indices.count { distance(hp[it], c[it]) > 12 } > 10,
                        "Hover must create its own softer outline",
                    )
                    renderer.hover(null, null)
                    renderer.options(
                        MapSceneOptions(
                            animate = false,
                            automaticLod = false,
                            selected = setOf(ref),
                        )
                    )
                    val blend =
                        model.copy(
                            uuid = "blend",
                            id = "blend",
                            renderUrl = "/api/maps/models/blend/render",
                        )
                    renderer.update(
                        document.with(
                            "tiles",
                            JsonArray(
                                listOf(
                                    document
                                        .rows("tiles")
                                        .single()
                                        .with("modelId", JsonPrimitive("blend"))
                                )
                            ),
                        ),
                        listOf(model, blend),
                    )
                    await { blend.renderUrl in renderer.readyModelUrls }
                    val alphaPick = CompletableDeferred<MapEntityRef?>()
                    renderer.pick(point.first, point.second) { alphaPick.complete(it) }
                    assertEquals(
                        ref,
                        withTimeout(5000) { alphaPick.await() },
                        "Alpha geometry remains pickable",
                    )
                    val alphaOutline = capture(renderer)
                    exportMapTestImage("surface-alpha-outlined.png", alphaOutline)
                    val alphaPixels = pixels(alphaOutline)
                    assertTrue(
                        alphaPixels.count { value ->
                            val red = (value shr 16) and 255
                            val green = (value shr 8) and 255
                            val blue = value and 255
                            blue > green + 12 && red > green + 5
                        } > 30,
                        "Alpha parts must write the selection mask and retain a visible final outline",
                    )
                    renderer.update(
                        document.with(
                            "objects",
                            JsonArray(
                                listOf(
                                    buildJsonObject {
                                        put("id", "occluder")
                                        put("modelId", "box")
                                        put("x", 2.5)
                                        put("y", 2.5)
                                        put("elevation", 2)
                                        put("scale", 4)
                                        put("rotation", 0)
                                    }
                                )
                            ),
                        ),
                        listOf(model),
                    )
                    await { MapEntityRef(MapEntityKind.Object, "occluder") in renderer.readyRefs }
                    val occluded = capture(renderer)
                    exportMapTestImage("surface-outline-occluded.png", occluded)
                    assertTrue(
                        pixels(occluded).count { value ->
                            val red = (value shr 16) and 255
                            val green = (value shr 8) and 255
                            val blue = value and 255
                            blue > green + 12 && red > green + 5
                        } < 20,
                        "A fully covered selection must not outline through foreground geometry",
                    )
                }
            } finally {
                folder.deleteRecursively()
            }
        }

    private suspend fun capture(scene: FilamentMapScene): Bitmap {
        val done = CompletableDeferred<Bitmap>()
        scene.snapshot { result -> result.fold(done::complete, done::completeExceptionally) }
        return withTimeout(5000) { done.await() }
    }

    private fun pixels(image: Bitmap) =
        IntArray(image.width * image.height).also {
            image.getPixels(it, 0, image.width, 0, 0, image.width, image.height)
        }

    private suspend fun await(condition: () -> Boolean) =
        withTimeout(20000) { while (!condition()) delay(25) }
}
