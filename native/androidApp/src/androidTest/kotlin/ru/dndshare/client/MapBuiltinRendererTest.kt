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

class MapBuiltinRendererTest {
    @Test
    fun aProceduralChestLoadsFromTheApkAndItsOpenStateChangesTheFrame() =
        runBlocking<Unit> {
            val context = InstrumentationRegistry.getInstrumentation().targetContext
            val folder = File(context.cacheDir, "builtin-map-${System.nanoTime()}")
            var downloads = 0
            val api =
                object : UnusedMapsApi() {
                    override suspend fun modelBytes(url: String): ByteArray {
                        downloads++
                        error("Local prop must not access the network")
                    }
                }
            val queue = MapSnapshotQueue(context, MapAssetCache(folder, api))
            val row = buildJsonObject {
                put("id", "chest")
                put("kind", "chest")
                put("x", 2)
                put("y", 2)
                put("elevation", .44)
                put("scale", 2)
                put("rotation", 0)
                put("open", false)
            }
            val doc =
                newMapDocument()
                    .with("width", JsonPrimitive(4))
                    .with("height", JsonPrimitive(4))
                    .with("grid", buildJsonObject { put("visible", false) })
                    .with("objects", JsonArray(listOf(row)))
            try {
                withTimeout(40_000) {
                    val a =
                        queue.snapshot(
                            doc,
                            emptyList(),
                            focus = setOf(MapEntityRef(MapEntityKind.Object, "chest")),
                            lod = false,
                        )
                    val b =
                        queue.snapshot(
                            doc.with(
                                "objects",
                                JsonArray(listOf(row.with("open", JsonPrimitive(true)))),
                            ),
                            emptyList(),
                            focus = setOf(MapEntityRef(MapEntityKind.Object, "chest")),
                            lod = false,
                        )
                    val before = IntArray(a.width * a.height)
                    val after = IntArray(before.size)
                    a.getPixels(before, 0, a.width, 0, 0, a.width, a.height)
                    b.getPixels(after, 0, b.width, 0, 0, b.width, b.height)
                    assertTrue(
                        before.indices.count { before[it] != after[it] } > 100,
                        "Opening the chest must change its geometry",
                    )
                    assertEquals(0, downloads)
                    exportMapTestImage("builtin-chest-closed.png", a)
                    exportMapTestImage("builtin-chest-open.png", b)
                }
            } finally {
                queue.close()
                folder.deleteRecursively()
            }
        }
}
