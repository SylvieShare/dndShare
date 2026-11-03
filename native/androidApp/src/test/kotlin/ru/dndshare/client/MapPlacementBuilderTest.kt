package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.MapCamera

class MapPlacementBuilderTest {
    private val floor =
        MapModel(
            "floor",
            "floor",
            "Пол",
            tileType = "floor",
            canStand = true,
            surfaceHeight = .5,
            supportSlots =
                JsonArray(
                    listOf(
                        buildJsonObject {
                            put("x", 0)
                            put("y", 0)
                            put("width", 1)
                            put("height", 1)
                            put("elevation", .5)
                        }
                    )
                ),
            placementPoints =
                JsonArray(
                    listOf(
                        buildJsonObject {
                            put("x", .5)
                            put("y", .5)
                            put("elevation", .5)
                        }
                    )
                ),
        )

    private fun tile(id: String, level: Int) = buildJsonObject {
        put("id", id)
        put("modelId", "floor")
        put("x", 2)
        put("y", 2)
        put("rotation", 0)
        put("level", level)
    }

    private val camera = MapCamera(x = 3.0, y = 3.0, pixels = 40.0)

    @Test
    fun aNewTileChoosesTheSupportPlaneRatherThanCollidingWithTheLowerFloor() {
        val doc =
            newMapDocument()
                .with("width", JsonPrimitive(6))
                .with("height", JsonPrimitive(6))
                .with("tiles", JsonArray(listOf(tile("base", 0))))
        val point = camera.project(MapPose(2.5, 2.5, .5), 400, 400)
        val result =
            buildMapPlacement(
                doc,
                listOf(floor),
                MapTool.Model("floor"),
                0,
                false,
                MapPose(2.5, 2.5),
                MapPlacementView(camera, point.first.toDouble(), point.second.toDouble(), 400, 400),
                newId = { "new" },
            )
        val placed = result.document.rows("tiles").find { it.string("id") == "new" }!!
        assertEquals(1.0, placed.number("level"))
        assertEquals(2.0, placed.number("x"))
        assertEquals(2.0, placed.number("y"))
    }

    @Test
    fun objectAnchoringUsesScreenDistanceWhenTwoFloorsShareTheSameXYPoint() {
        val objectModel = MapModel("object", "object", "Предмет", tileType = "object")
        val doc =
            newMapDocument().with("tiles", JsonArray(listOf(tile("base", 0), tile("upper", 1))))
        val pixel = camera.project(MapPose(2.5, 2.5, .5), 400, 400)
        val result =
            buildMapPlacement(
                doc,
                listOf(floor, objectModel),
                MapTool.Model("object"),
                0,
                false,
                MapPose(2.5, 2.5),
                MapPlacementView(camera, pixel.first.toDouble(), pixel.second.toDouble(), 400, 400),
                newId = { "object" },
            )
        val placed = result.document.rows("objects").single()
        assertEquals("base", placed.getValue("placement").jsonObject.string("tileId"))
    }
}
