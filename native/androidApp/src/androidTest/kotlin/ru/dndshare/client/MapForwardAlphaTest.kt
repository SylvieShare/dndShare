package ru.dndshare.client

import android.graphics.Bitmap
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import kotlin.math.abs
import kotlin.test.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

class MapForwardAlphaTest {
    @Test
    fun alphaPartsUseTheMergedDepthAndMixedMeshesKeepTheirOwnOpacity() =
        runBlocking<Unit> {
            val test = InstrumentationRegistry.getInstrumentation()
            val context = test.targetContext
            val folder = File(context.cacheDir, "map-alpha-${System.nanoTime()}")
            val api =
                object : UnusedMapsApi() {
                    override suspend fun modelBytes(url: String): ByteArray {
                        val name = url.substringAfter("models/").substringBefore('/')
                        return test.context.assets.open("maps/flat-$name.glb").use {
                            it.readBytes()
                        }
                    }
                }
            val queue = MapSnapshotQueue(context, MapAssetCache(folder, api))
            val models =
                listOf("blue", "green", "red-blend", "mixed").map { id ->
                    MapModel(
                        id,
                        id,
                        id,
                        tileType = "object",
                        width = 2,
                        height = 2,
                        maxHeight = 1.0,
                        renderUrl = "/api/maps/models/$id/render",
                    )
                }
            fun obj(id: String, height: Double) = buildJsonObject {
                put("id", id)
                put("modelId", id)
                put("kind", "table")
                put("x", 3)
                put("y", 3)
                put("elevation", height)
                put("scale", 1)
                put("rotation", 0)
            }
            fun doc(objects: List<JsonObject>, hidden: List<String>) =
                newMapDocument()
                    .with("width", JsonPrimitive(6))
                    .with("height", JsonPrimitive(6))
                    .with("grid", buildJsonObject { put("visible", false) })
                    .with("objects", JsonArray(objects))
                    .with(
                        "areas",
                        JsonArray(
                            listOf(
                                buildJsonObject {
                                    put("id", "ghost")
                                    put("hidden", true)
                                    put("tileIds", JsonArray(emptyList()))
                                    put("objectIds", JsonArray(hidden.map(::JsonPrimitive)))
                                }
                            )
                        ),
                    )
            val camera =
                MapCamera(
                    x = 3.0,
                    y = 3.0,
                    pixels = 70.0,
                    tilt = 90.0,
                    azimuth = 0.0,
                    elevation = .5,
                )
            try {
                val background =
                    queue.snapshot(
                        doc(listOf(obj("blue", 0.0), obj("green", 1.0)), listOf("green")),
                        models,
                        camera = camera,
                    )
                val behind =
                    queue.snapshot(
                        doc(
                            listOf(obj("blue", 0.0), obj("green", 1.0), obj("red-blend", .5)),
                            listOf("green"),
                        ),
                        models,
                        camera = camera,
                    )
                val front =
                    queue.snapshot(
                        doc(
                            listOf(obj("blue", 0.0), obj("green", 1.0), obj("red-blend", 1.5)),
                            listOf("green"),
                        ),
                        models,
                        camera = camera,
                    )
                val faint =
                    queue.snapshot(
                        doc(
                            listOf(obj("blue", 0.0), obj("green", 1.0), obj("red-blend", 1.5)),
                            listOf("green", "red-blend"),
                        ),
                        models,
                        camera = camera,
                    )
                val mixed =
                    queue.snapshot(
                        doc(listOf(obj("blue", 0.0), obj("mixed", 1.0)), listOf("mixed")),
                        models,
                        camera = camera,
                    )
                fun distance(a: Bitmap, b: Bitmap): Long {
                    val x = pixels(a)
                    val y = pixels(b)
                    return x.indices.sumOf { i ->
                        listOf(0, 8, 16).sumOf {
                            abs(((x[i] shr it) and 255) - ((y[i] shr it) and 255)).toLong()
                        }
                    }
                }
                val red = distance(background, front)
                val dim = distance(background, faint)
                assertTrue(
                    distance(background, behind) < background.width * background.height * 3,
                    "Glass behind a nearest ghost surface must fail the merged depth test",
                )
                assertTrue(red > 10000, "Glass in front must remain visible")
                assertTrue(
                    dim > red * .01 && dim < red * .35,
                    "Glass must use its own area's opacity: $dim/$red",
                )
                assertTrue(
                    distance(faint, mixed) < mixed.width * mixed.height * 3,
                    "Opaque and alpha parts of a single mesh must keep independent render state",
                )
                exportMapTestImage("alpha-front.png", front)
                exportMapTestImage("alpha-faint.png", faint)
                exportMapTestImage("alpha-mixed.png", mixed)
            } finally {
                queue.close()
                folder.deleteRecursively()
            }
        }

    @Test
    fun forwardTransparentReceiverKeepsShadowsFromOrdinaryOpaqueCasters() =
        runBlocking<Unit> {
            val test = InstrumentationRegistry.getInstrumentation()
            val context = test.targetContext
            val folder = File(context.cacheDir, "map-alpha-shadow-${System.nanoTime()}")
            val api =
                object : UnusedMapsApi() {
                    override suspend fun modelBytes(url: String): ByteArray {
                        val name =
                            if (url.contains("box")) "box.glb"
                            else "flat-${url.substringAfter("models/").substringBefore('/')}.glb"
                        return test.context.assets.open("maps/$name").use { it.readBytes() }
                    }
                }
            val queue = MapSnapshotQueue(context, MapAssetCache(folder, api))
            val models =
                listOf("shadow-blend", "green", "box").map { id ->
                    MapModel(
                        id,
                        id,
                        id,
                        tileType = "object",
                        width = 2,
                        height = 2,
                        maxHeight = 1.0,
                        renderUrl = "/api/maps/models/$id/render",
                    )
                }
            fun obj(id: String, x: Double, y: Double, height: Double, scale: Double = 1.0) =
                buildJsonObject {
                    put("id", id)
                    put("modelId", id)
                    put("kind", "table")
                    put("x", x)
                    put("y", y)
                    put("elevation", height)
                    put("scale", scale)
                    put("rotation", 0)
                }
            val light = buildJsonObject {
                put("id", "lamp")
                put("x", 1)
                put("y", 3)
                put("elevation", 0)
                put("height", 3)
                put("color", "#ffffff")
                put("enabled", true)
                put("flicker", false)
                put("intensity", 20)
                put("radius", 12)
                put("shadows", false)
            }
            val doc =
                newMapDocument()
                    .with("width", JsonPrimitive(6))
                    .with("height", JsonPrimitive(6))
                    .with("grid", buildJsonObject { put("visible", false) })
                    .with("lightingEnabled", JsonPrimitive(true))
                    .with(
                        "sun",
                        buildJsonObject {
                            put("enabled", false)
                            put("angle", 225)
                            put("elevation", 45)
                        },
                    )
                    .with("lights", JsonArray(listOf(light)))
                    .with(
                        "objects",
                        JsonArray(
                            listOf(
                                obj("shadow-blend", 3.0, 3.0, 0.0, 3.0),
                                obj("box", 3.0, 3.0, .5),
                                obj("green", 1.0, 1.0, .05),
                            )
                        ),
                    )
                    .with(
                        "areas",
                        JsonArray(
                            listOf(
                                buildJsonObject {
                                    put("id", "ghost")
                                    put("hidden", true)
                                    put("tileIds", JsonArray(emptyList()))
                                    put("objectIds", JsonArray(listOf(JsonPrimitive("green"))))
                                }
                            )
                        ),
                    )
            val camera =
                MapCamera(
                    x = 3.0,
                    y = 3.0,
                    pixels = 50.0,
                    tilt = 90.0,
                    azimuth = 0.0,
                    elevation = .5,
                )
            try {
                val before = queue.snapshot(doc, models, camera = camera)
                val after =
                    queue.snapshot(
                        doc.with(
                            "lights",
                            JsonArray(listOf(light.with("shadows", JsonPrimitive(true)))),
                        ),
                        models,
                        camera = camera,
                    )
                var changed = 0
                for (x in 0..24) for (y in 0..14) {
                    val point =
                        camera.project(
                            MapPose(3.6 + x * .055, 2.6 + y * .055, 0.0),
                            before.width,
                            before.height,
                        )
                    val px = point.first.toInt()
                    val py = point.second.toInt()
                    val a = before.getPixel(px, py)
                    val b = after.getPixel(px, py)
                    if (listOf(0, 8, 16).sumOf { ((a shr it) and 255) - ((b shr it) and 255) } > 15)
                        changed++
                }
                exportMapTestImage("alpha-shadow-before.png", before)
                exportMapTestImage("alpha-shadow-after.png", after)
                assertTrue(
                    changed > 30,
                    "A transparent receiver must keep the opaque world's shadow map: $changed",
                )
            } finally {
                queue.close()
                folder.deleteRecursively()
            }
        }

    private fun pixels(image: Bitmap) =
        IntArray(image.width * image.height).also {
            image.getPixels(it, 0, image.width, 0, 0, image.width, image.height)
        }
}
