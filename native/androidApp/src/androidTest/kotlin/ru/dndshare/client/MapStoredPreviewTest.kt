package ru.dndshare.client

import android.graphics.BitmapFactory
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import kotlin.test.*
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.model.WireJson
import ru.dndshare.client.network.ApiException

class MapStoredPreviewTest {
    @Test
    fun webpUploadRetriesAChangedServerSignatureAndReusesTheResult() = runBlocking {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val bytes = instrumentation.context.assets.open("maps/box.glb").use { it.readBytes() }
        val model =
            MapModel(
                "box",
                "box",
                "Куб",
                tileType = "floor",
                renderUrl = "/api/maps/models/box/render",
            )
        val doc =
            newMapDocument()
                .with("width", JsonPrimitive(6))
                .with("height", JsonPrimitive(6))
                .with(
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
        var contexts = 0
        val uploads = mutableListOf<String>()
        val api =
            object : UnusedMapsApi() {
                override suspend fun modelBytes(url: String) = bytes

                override suspend fun previewContext(id: String) = buildJsonObject {
                    put("signature", if (contexts++ == 0) "before" else "after")
                    put("modelsSignature", "model-hash")
                    put("document", doc)
                    put(
                        "models",
                        JsonArray(
                            listOf(WireJson.encodeToJsonElement(MapModel.serializer(), model))
                        ),
                    )
                }

                override suspend fun uploadPreview(
                    id: String,
                    signature: String,
                    bytes: ByteArray,
                ): JsonObject {
                    uploads += signature
                    assertEquals("RIFF", bytes.copyOfRange(0, 4).decodeToString())
                    assertEquals("WEBP", bytes.copyOfRange(8, 12).decodeToString())
                    val image = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    assertEquals(420, image.width)
                    assertEquals(280, image.height)
                    image.recycle()
                    assertTrue(bytes.size < 1024 * 1024)
                    if (signature == "before")
                        throw ApiException(409, "CONFLICT", "Карта изменилась")
                    return buildJsonObject {
                        put("previewUrl", "/api/maps/map/preview?signature=after")
                    }
                }
            }
        val folder = File(context.cacheDir, "map-stored-preview-${System.nanoTime()}")
        val queue = MapSnapshotQueue(context, MapAssetCache(folder, api))
        val previews = MapStoredPreviews(api, queue)
        try {
            withTimeout(40_000) {
                val result =
                    previews.ensure(
                        BattleMap(
                            id = "map",
                            document = doc,
                            previewSignature = "before",
                            previewStale = true,
                        )
                    )
                assertEquals(listOf("before", "after"), uploads)
                assertEquals("after", result.signature)
                assertEquals(
                    result,
                    previews.ensure(
                        BattleMap(
                            id = "map",
                            document = doc,
                            previewSignature = "after",
                            previewStale = true,
                        )
                    ),
                )
                assertEquals(2, contexts)
            }
        } finally {
            queue.close()
            folder.deleteRecursively()
        }
    }
}
