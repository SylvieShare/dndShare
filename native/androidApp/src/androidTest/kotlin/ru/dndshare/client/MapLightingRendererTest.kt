package ru.dndshare.client

import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import kotlin.test.*
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

class MapLightingRendererTest {
    @Test
    fun pointShadowChangesTheGroundImageWithoutReplacingTheUploadedModel() =
        runBlocking<Unit> {
            val instrumentation = InstrumentationRegistry.getInstrumentation()
            val context = instrumentation.targetContext
            val bytes = instrumentation.context.assets.open("maps/box.glb").use { it.readBytes() }
            val floorBytes =
                instrumentation.context.assets.open("maps/box-shadow-floor.glb").use {
                    it.readBytes()
                }
            var downloads = 0
            val api =
                object : UnusedMapsApi() {
                    override suspend fun modelBytes(url: String): ByteArray {
                        downloads++
                        return if (url.contains("floor")) floorBytes else bytes
                    }
                }
            val folder = File(context.cacheDir, "map-shadow-${System.nanoTime()}")
            val queue = MapSnapshotQueue(context, MapAssetCache(folder, api))
            val model =
                MapModel(
                    "box",
                    "box",
                    "Куб",
                    tileType = "floor",
                    renderUrl = "/api/maps/models/box/render",
                )
            val floor =
                MapModel(
                    "floor",
                    "floor",
                    "Пол",
                    tileType = "object",
                    renderUrl = "/api/maps/models/floor/render",
                )
            val light = buildJsonObject {
                put("id", "torch")
                put("x", 2)
                put("y", 3)
                put("elevation", .44)
                put("height", 3)
                put("color", "#ffffff")
                put("intensity", 20)
                put("radius", 12)
                put("enabled", true)
                put("flicker", false)
                put("shadows", false)
            }
            val doc =
                newMapDocument()
                    .with("width", JsonPrimitive(8))
                    .with("height", JsonPrimitive(8))
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
                        "tiles",
                        JsonArray(
                            listOf(
                                buildJsonObject {
                                    put("id", "one")
                                    put("modelId", "box")
                                    put("x", 4)
                                    put("y", 3)
                                    put("rotation", 0)
                                    put("level", 0)
                                }
                            )
                        ),
                    )
            val withReceiver =
                doc.with(
                    "objects",
                    JsonArray(
                        listOf(
                            buildJsonObject {
                                put("id", "ground")
                                put("kind", "table")
                                put("modelId", "floor")
                                put("x", 4)
                                put("y", 4)
                                put("elevation", 0)
                                put("scale", 1)
                                put("rotation", 0)
                            }
                        )
                    ),
                )
            try {
                withTimeout(40_000) {
                    val before = queue.snapshot(withReceiver, listOf(model, floor), lod = false)
                    val after =
                        queue.snapshot(
                            withReceiver.with(
                                "lights",
                                JsonArray(listOf(light.with("shadows", JsonPrimitive(true)))),
                            ),
                            listOf(model, floor),
                            lod = false,
                        )
                    exportMapTestImage("shadow-before.png", before)
                    exportMapTestImage("shadow-after.png", after)
                    val a = IntArray(before.width * before.height)
                    val b = IntArray(a.size)
                    before.getPixels(a, 0, before.width, 0, 0, before.width, before.height)
                    after.getPixels(b, 0, after.width, 0, 0, after.width, after.height)
                    val darker =
                        a.indices.count { i ->
                            val av =
                                ((a[i] shr 16) and 255) + ((a[i] shr 8) and 255) + (a[i] and 255)
                            val bv =
                                ((b[i] shr 16) and 255) + ((b[i] shr 8) and 255) + (b[i] and 255)
                            av - bv > 12
                        }
                    assertTrue(
                        darker > 80,
                        "The box must cast a visible point-light shadow; darker pixels: $darker",
                    )
                    val acne =
                        (140 until 180).sumOf { y ->
                            (80 until 160).count { x ->
                                val i = y * before.width + x
                                ((a[i] shr 16) and 255) - ((b[i] shr 16) and 255) > 12
                            }
                        }
                    assertTrue(
                        acne < 40,
                        "An unoccluded receiver must stay clean; acne pixels: $acne",
                    )
                    assertEquals(2, downloads)
                }
            } finally {
                queue.close()
                folder.deleteRecursively()
            }
        }
}
