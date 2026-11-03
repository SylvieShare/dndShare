package ru.dndshare.client

import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import kotlin.math.*
import kotlin.test.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

class MapColourOutputTest {
    @Test
    fun backgroundBypassesToneMappingAndAnUnlitModelUsesTheWebAcesFit() =
        runBlocking<Unit> {
            val test = InstrumentationRegistry.getInstrumentation()
            val context = test.targetContext
            val bytes = test.context.assets.open("maps/box-unlit.glb").use { it.readBytes() }
            val folder = File(context.cacheDir, "map-colour-${System.nanoTime()}")
            val api =
                object : UnusedMapsApi() {
                    override suspend fun modelBytes(url: String) = bytes
                }
            val queue = MapSnapshotQueue(context, MapAssetCache(folder, api))
            val empty =
                newMapDocument()
                    .with("width", JsonPrimitive(4))
                    .with("height", JsonPrimitive(4))
                    .with("grid", buildJsonObject { put("visible", false) })
            val document =
                empty.with(
                    "tiles",
                    JsonArray(
                        listOf(
                            buildJsonObject {
                                put("id", "one")
                                put("modelId", "box")
                                put("x", 1)
                                put("y", 1)
                                put("rotation", 0)
                                put("level", 0)
                            }
                        )
                    ),
                )
            val model = MapModel("box", "box", "Куб", renderUrl = "/api/maps/models/box/render")
            try {
                val background = queue.snapshot(empty, listOf(model))
                val pixel = background.getPixel(background.width / 2, background.height / 2)
                for ((shift, expected) in listOf(16 to 0x16, 8 to 0x1b, 0 to 0x23)) assertTrue(
                    abs(((pixel shr shift) and 255) - expected) <= 2,
                    "Background must match #161b23: ${pixel.toUInt().toString(16)}",
                )
                val image = queue.snapshot(document, listOf(model))
                exportMapTestImage("colour-web-aces.png", image)
                val colour = webAces(doubleArrayOf(.2, .4, .8))
                val pixels = IntArray(image.width * image.height)
                image.getPixels(pixels, 0, image.width, 0, 0, image.width, image.height)
                val matching = pixels.count { value ->
                    listOf(16, 8, 0).withIndex().all { (i, shift) ->
                        abs(((value shr shift) and 255) - colour[i]) <= 4
                    }
                }
                assertTrue(
                    matching > 500,
                    "Unlit GLB must use web ACES/sRGB once; expected=${colour.toList()}, matching=$matching",
                )
            } finally {
                queue.close()
                folder.deleteRecursively()
            }
        }

    private fun webAces(input: DoubleArray): IntArray {
        fun multiply(m: Array<DoubleArray>, v: DoubleArray) =
            DoubleArray(3) { r -> (0..2).sumOf { c -> m[r][c] * v[c] } }
        val v =
            multiply(
                arrayOf(
                    doubleArrayOf(.59719, .35458, .04823),
                    doubleArrayOf(.076, .90834, .01566),
                    doubleArrayOf(.0284, .13383, .83777),
                ),
                input.map { it / .6 }.toDoubleArray(),
            )
        val fit =
            v.map {
                    (it * (it + .0245786) - .000090537) / (it * (.983729 * it + .432951) + .238081)
                }
                .toDoubleArray()
        val out =
            multiply(
                arrayOf(
                    doubleArrayOf(1.60475, -.53108, -.07367),
                    doubleArrayOf(-.10208, 1.10813, -.00605),
                    doubleArrayOf(-.00327, -.07276, 1.07602),
                ),
                fit,
            )
        return IntArray(3) {
            val c = out[it].coerceIn(0.0, 1.0)
            ((if (c <= .0031308) c * 12.92 else 1.055 * c.pow(1 / 2.4) - .055) * 255).roundToInt()
        }
    }
}
