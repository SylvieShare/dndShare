package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.model.WireJson

class MapGeometryTest {
    private fun json(text: String) = WireJson.parseToJsonElement(text).jsonObject

    private val floor = MapModel("floor", "floor", "Пол")

    @Test
    fun cameraProjectionAndWorldAreInverseAtEveryTargetWindow() {
        for ((width, height) in listOf(390 to 700, 834 to 900, 1920 to 1080)) {
            for (tilt in listOf(20.0, 35.264389682754654, 90.0)) {
                val camera = MapCamera(tilt = tilt).fit(30.0, 22.0, width, height)
                val original = MapPose(7.5, 11.25, 2.4)
                val screen = camera.project(original, width, height)
                val recovered =
                    camera.world(
                        screen.first.toDouble(),
                        screen.second.toDouble(),
                        width,
                        height,
                        original.elevation,
                    )
                assertEquals(original.x, recovered.x, 0.0001)
                assertEquals(original.y, recovered.y, 0.0001)
            }
        }
    }

    @Test
    fun pinchKeepsTheWorldPointUnderTheFingers() {
        val view = MapCamera()
        val before = view.world(135.0, 370.0, 390, 700)
        val next = view.zoom(1.8, 135.0, 370.0, 390, 700)
        val after = next.world(135.0, 370.0, 390, 700)
        assertEquals(before.x, after.x, 0.0000001)
        assertEquals(before.y, after.y, 0.0000001)
    }

    @Test
    fun overlapAndMissingSupportAreRejectedBeforeEditingTheDocument() {
        val doc = newMapDocument().let { mapPlaceTile(it, floor, MapPose(1.0, 1.0), 0, 0) }
        assertFailsWith<IllegalArgumentException> {
            mapPlacements(
                mapPlaceTile(doc, floor, MapPose(1.0, 1.0), 0, 0),
                mapOf("floor" to floor),
            )
        }
        assertFailsWith<IllegalArgumentException> {
            mapPlacements(
                mapPlaceTile(newMapDocument(), floor, MapPose(1.0, 1.0), 0, 1),
                mapOf("floor" to floor),
            )
        }
        assertEquals(1, mapPlacements(doc, mapOf("floor" to floor)).size)
    }

    @Test
    fun highestSupportAndInsertionRiseMatchTheServerContract() {
        val parent =
            floor.copy(
                id = "frame",
                uuid = "frame",
                supportSlots =
                    JsonArray(
                        listOf(
                            json(
                                """{"x":0,"y":0,"width":1,"height":1,"elevation":1.6,"insertionRise":0.1}"""
                            )
                        )
                    ),
            )
        val child = floor.copy(mountDepth = .2)
        val doc =
            newMapDocument()
                .with(
                    "tiles",
                    JsonArray(
                        listOf(
                            json(
                                """{"id":"parent","modelId":"frame","x":0,"y":0,"level":0,"rotation":0}"""
                            ),
                            json(
                                """{"id":"child","modelId":"floor","x":0,"y":0,"level":1,"rotation":0}"""
                            ),
                        )
                    ),
                )
        val result = mapPlacements(doc, mapOf("frame" to parent, "floor" to child))
        assertEquals(1.7, result.getValue("child").elevation, .00001)
        assertEquals(setOf("parent"), result.getValue("child").parents)
        assertEquals(
            setOf("parent", "child"),
            mapDependentTiles(doc, mapOf("frame" to parent, "floor" to child), setOf("parent")),
        )
    }

    @Test
    fun mirroredSurfaceRotatesWithItsOwner() {
        val tile = json("""{"id":"a","x":4,"y":5,"rotation":90,"mirrored":true}""")
        val model = floor.copy(width = 2)
        val point = json("""{"x":0.25,"y":0.5,"elevation":0.4}""")
        assertEquals(MapPose(4.5, 6.75, .4), mapSurface(tile, model, point, 0.0))
    }
}
