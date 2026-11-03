package ru.dndshare.client

import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import kotlin.test.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

class MapPbrTextureTest {
    @Test
    fun basisAndUastcAppearThroughOrdinaryPbrWithoutNativeWaterReplacement() =
        runBlocking<Unit> {
            val test = InstrumentationRegistry.getInstrumentation()
            val api =
                object : UnusedMapsApi() {
                    override suspend fun modelBytes(url: String) =
                        test.context.assets.open("maps/box-pbr-${url.removePrefix("/")}.glb").use {
                            it.readBytes()
                        }
                }
            val root = File(test.targetContext.cacheDir, "pbr-ktx-${System.nanoTime()}")
            val queue = MapSnapshotQueue(test.targetContext, MapAssetCache(root, api))
            val document =
                newMapDocument()
                    .with("width", JsonPrimitive(2))
                    .with("height", JsonPrimitive(2))
                    .with("grid", buildJsonObject { put("visible", false) })
                    .with(
                        "tiles",
                        JsonArray(
                            listOf(
                                buildJsonObject {
                                    put("id", "box")
                                    put("modelId", "box")
                                    put("x", 0)
                                    put("y", 0)
                                    put("rotation", 0)
                                    put("level", 0)
                                }
                            )
                        ),
                    )
            try {
                for (codec in listOf("basis-lz", "uastc")) {
                    val model = MapModel("box", "box", "PBR", renderUrl = "/$codec")
                    assertTrue(model.behaviour.isEmpty())
                    val image =
                        queue.snapshot(
                            document,
                            listOf(model),
                            lod = false,
                            camera =
                                MapCamera(
                                    x = .5,
                                    y = .5,
                                    elevation = .5,
                                    pixels = 160.0,
                                    tilt = 90.0,
                                    azimuth = 0.0,
                                ),
                        )
                    val pixels = IntArray(image.width * image.height)
                    image.getPixels(pixels, 0, image.width, 0, 0, image.width, image.height)
                    val red = pixels.count { ((it shr 16) and 255) > (it and 255) + 30 }
                    val blue = pixels.count { (it and 255) > ((it shr 16) and 255) + 30 }
                    assertTrue(
                        red > 500 && blue > 500,
                        "$codec must preserve both encoded colours through gltfio PBR: red=$red, blue=$blue",
                    )
                    exportMapTestImage("pbr-$codec.png", image)
                }
            } finally {
                queue.close()
                root.deleteRecursively()
            }
        }
}
