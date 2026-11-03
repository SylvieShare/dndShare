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

class MapShadowProxyTest {
    @Test
    fun dedicatedGeometryIsInvisibleButCastsItsOwnShadowAndFollowsTheInstance() =
        runBlocking<Unit> {
            val test = InstrumentationRegistry.getInstrumentation()
            val small = test.context.assets.open("maps/review-tile.glb").use { it.readBytes() }
            val proxy = test.context.assets.open("maps/box.glb").use { it.readBytes() }
            val floor = test.context.assets.open("maps/box-shadow-floor.glb").use { it.readBytes() }
            val api =
                object : UnusedMapsApi() {
                    override suspend fun modelBytes(url: String) =
                        when {
                            url.endsWith("proxy") -> proxy
                            url.contains("floor") -> floor
                            else -> small
                        }
                }
            val root = File(test.targetContext.cacheDir, "shadow-proxy-${System.nanoTime()}")
            val queue = MapSnapshotQueue(test.targetContext, MapAssetCache(root, api))
            val box = MapModel("box", "box", "Куб", renderUrl = "/box")
            val detailed = box.copy(raw = buildJsonObject { put("shadowUrl", "/proxy") })
            val receiver =
                MapModel("floor", "floor", "Пол", tileType = "object", renderUrl = "/floor")
            fun document(shadow: Boolean, x: Int = 4) =
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
                    .with(
                        "tiles",
                        JsonArray(
                            listOf(
                                buildJsonObject {
                                    put("id", "box")
                                    put("modelId", "box")
                                    put("x", x)
                                    put("y", 3)
                                    put("level", 0)
                                    put("rotation", 0)
                                }
                            )
                        ),
                    )
                    .with(
                        "objects",
                        JsonArray(
                            listOf(
                                buildJsonObject {
                                    put("id", "receiver")
                                    put("modelId", "floor")
                                    put("kind", "table")
                                    put("x", 4)
                                    put("y", 4)
                                    put("elevation", 0)
                                    put("scale", 1)
                                    put("rotation", 0)
                                }
                            )
                        ),
                    )
                    .with(
                        "lights",
                        JsonArray(
                            listOf(
                                buildJsonObject {
                                    put("id", "light")
                                    put("x", 2)
                                    put("y", 3)
                                    put("elevation", .44)
                                    put("height", 3)
                                    put("radius", 12)
                                    put("color", "#ffffff")
                                    put("intensity", 20)
                                    put("enabled", true)
                                    put("flicker", false)
                                    put("shadows", shadow)
                                }
                            )
                        ),
                    )
            try {
                withTimeout(50_000) {
                    val plain = queue.snapshot(document(false), listOf(box, receiver), lod = false)
                    val invisible =
                        queue.snapshot(document(false), listOf(detailed, receiver), lod = false)
                    val smallShadow =
                        queue.snapshot(document(true), listOf(box, receiver), lod = false)
                    val largeShadow =
                        queue.snapshot(document(true), listOf(detailed, receiver), lod = false)
                    val moved =
                        queue.snapshot(document(true, 5), listOf(detailed, receiver), lod = false)
                    val a = pixels(plain)
                    val b = pixels(invisible)
                    val c = pixels(smallShadow)
                    val d = pixels(largeShadow)
                    val e = pixels(moved)
                    val visibleDifference = a.indices.count { abs(rgb(a[it]) - rgb(b[it])) > 12 }
                    assertTrue(
                        visibleDifference < 40,
                        "The proxy must not write colour or visible depth: $visibleDifference",
                    )
                    val additionalShadow = c.indices.count { rgb(c[it]) - rgb(d[it]) > 12 }
                    assertTrue(
                        additionalShadow > 80,
                        "Dedicated larger geometry must change the shadow footprint: $additionalShadow",
                    )
                    val movement = d.indices.count { abs(rgb(d[it]) - rgb(e[it])) > 12 }
                    assertTrue(movement > 100, "The proxy must follow the moved tile: $movement")
                    val areas =
                        JsonArray(
                            listOf(
                                buildJsonObject {
                                    put("id", "room")
                                    put("name", "Зал")
                                    put("hidden", true)
                                    put("tileIds", JsonArray(listOf(JsonPrimitive("box"))))
                                    put("objectIds", JsonArray(emptyList()))
                                }
                            )
                        )
                    val hidden =
                        queue.snapshot(
                            document(true).with("areas", areas),
                            listOf(detailed, receiver),
                            lod = false,
                        )
                    val hiddenWithoutShadows =
                        queue.snapshot(
                            document(false).with("areas", areas),
                            listOf(detailed, receiver),
                            lod = false,
                        )
                    val h = pixels(hidden)
                    val n = pixels(hiddenWithoutShadows)
                    val hiddenShadow = h.indices.count { rgb(n[it]) - rgb(h[it]) > 12 }
                    assertTrue(
                        hiddenShadow < 40,
                        "A hidden area's proxy and visible mesh must stop casting: $hiddenShadow",
                    )
                    exportMapTestImage("shadow-proxy-before.png", smallShadow)
                    exportMapTestImage("shadow-proxy-after.png", largeShadow)
                    exportMapTestImage("shadow-proxy-moved.png", moved)
                }
            } finally {
                queue.close()
                root.deleteRecursively()
            }
        }

    private fun pixels(image: Bitmap) =
        IntArray(image.width * image.height).also {
            image.getPixels(it, 0, image.width, 0, 0, image.width, image.height)
        }

    private fun rgb(value: Int) =
        ((value shr 16) and 255) + ((value shr 8) and 255) + (value and 255)
}
