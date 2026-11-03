package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.MapCamera

class MapMovePlacementTest {
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
        )
    private val ref = MapEntityRef(MapEntityKind.Tile, "moving")

    private fun tile(id: String, x: Int, level: Int = 0) = buildJsonObject {
        put("id", id)
        put("modelId", "floor")
        put("x", x)
        put("y", 2)
        put("rotation", 0)
        put("level", level)
    }

    private fun document(vararg tiles: JsonObject) =
        newMapDocument()
            .with("width", JsonPrimitive(8))
            .with("height", JsonPrimitive(8))
            .with("tiles", JsonArray(tiles.toList()))

    @Test
    fun releasePreservesNewCanonicalFieldsAndReturningToOriginUsesTheOriginalGrip() {
        val start = document(tile("moving", 2))
        val layout = captureMapMove(start, listOf(floor), emptySet(), ref)
        val grip = MapPose(2.3, 2.7)
        val latest =
            start
                .with("receivedWhileDragging", JsonPrimitive(true))
                .with(
                    "tiles",
                    JsonArray(
                        listOf(
                            start.rows("tiles").single().with("name", JsonPrimitive("Новое имя"))
                        )
                    ),
                )
        val moved = placeMapMove(latest, listOf(floor), layout, ref, grip, null, MapPose(4.3, 3.7))
        assertEquals(4.0, moved.rows("tiles").single().number("x"))
        assertEquals(3.0, moved.rows("tiles").single().number("y"))
        assertEquals("Новое имя", moved.rows("tiles").single().string("name"))
        assertEquals(JsonPrimitive(true), moved["receivedWhileDragging"])
        val returned = placeMapMove(latest, listOf(floor), layout, ref, grip, null, grip)
        assertEquals(latest, returned)
    }

    @Test
    fun groupMovesTogetherOntoSupportAndBackWithoutDetachingDependants() {
        val start = document(tile("moving", 2), tile("child", 2, 1), tile("base", 5))
        val layout = captureMapMove(start, listOf(floor), emptySet(), ref)
        assertEquals(setOf("moving", "child"), layout.tiles.map { it.string("id") }.toSet())
        val camera = MapCamera(x = 4.0, y = 4.0, pixels = 50.0)
        // Hold the root's top surface. At the target its bottom rests on base's top.
        val grip = MapPose(2.5, 2.5, .5)
        val pixel = camera.project(MapPose(5.5, 2.5, 1.0), 400, 400)
        val moved =
            placeMapMove(
                start,
                listOf(floor),
                layout,
                ref,
                grip,
                MapPlacementView(camera, pixel.first.toDouble(), pixel.second.toDouble(), 400, 400),
                grip,
            )
        val rows = moved.rows("tiles").associateBy { it.string("id") }
        assertEquals(5.0, rows.getValue("moving").number("x"))
        assertEquals(1.0, rows.getValue("moving").number("level"))
        assertEquals(2.0, rows.getValue("child").number("level"))
        val returned = placeMapMove(start, listOf(floor), layout, ref, grip, null, grip)
        assertEquals(start, returned)
    }
}
