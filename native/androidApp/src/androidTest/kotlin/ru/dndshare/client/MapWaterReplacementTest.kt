package ru.dndshare.client

import android.graphics.Bitmap
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import kotlin.test.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

class MapWaterReplacementTest {
    @Test
    fun transparentAndCutoutWaterReplaceTheOriginalPrimitiveRatherThanBlendingTwice() =
        runBlocking<Unit> {
            val test = InstrumentationRegistry.getInstrumentation()
            val context = test.targetContext
            val folder = File(context.cacheDir, "map-water-alpha-${System.nanoTime()}")
            val api =
                object : UnusedMapsApi() {
                    override suspend fun modelBytes(url: String): ByteArray =
                        test.context.assets
                            .open(
                                "maps/box-water-${if(url.contains("mask"))"mask" else "blend"}.glb"
                            )
                            .use { it.readBytes() }
                }
            val queue = MapSnapshotQueue(context, MapAssetCache(folder, api))
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
                                    put("id", "water")
                                    put("modelId", "water")
                                    put("x", 1)
                                    put("y", 1)
                                    put("rotation", 0)
                                    put("level", 0)
                                }
                            )
                        ),
                    )
            try {
                for (mode in listOf("blend", "mask")) {
                    val model =
                        MapModel(
                            "water",
                            "water",
                            "Вода",
                            renderUrl = "/api/maps/models/$mode/render",
                        )
                    val original = queue.snapshot(doc, listOf(model))
                    val animated =
                        model.copy(
                            behaviour =
                                buildJsonObject {
                                    put(
                                        "waterAnimation",
                                        buildJsonObject {
                                            put("enabled", true)
                                            put("speed", 0)
                                            put("strength", 0)
                                            put("roughnessMax", .5)
                                        },
                                    )
                                }
                        )
                    val replaced = queue.snapshot(doc, listOf(animated))
                    val first = pixels(original)
                    val second = pixels(replaced)
                    val differences =
                        first.indices.map { i ->
                            listOf(0, 8, 16).maxOf {
                                kotlin.math.abs(
                                    ((first[i] shr it) and 255) - ((second[i] shr it) and 255)
                                )
                            }
                        }
                    exportMapTestImage("water-$mode-original.png", original)
                    exportMapTestImage("water-$mode-replaced.png", replaced)
                    assertTrue(
                        differences.average() < 3 &&
                            differences.count { it > 20 } < differences.size / 100,
                        "$mode replacement changed opacity or alpha cutout: mean=${differences.average()}, outliers=${differences.count {it>20}}",
                    )
                }
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
