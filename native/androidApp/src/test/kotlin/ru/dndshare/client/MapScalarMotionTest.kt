package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*

class MapScalarMotionTest {
    @Test
    fun visibilityAndFlashUseTheWebSmoothstepAndCanReverseMidTransition() {
        val motion = MapScalarMotion<String>()
        motion.set("area", 1.0, immediate = true)
        motion.set("area", 0.0, duration = 480.0)
        motion.advance(120.0)
        assertEquals(.84375, motion.value("area"), 1e-9)
        assertEquals(1.8838834764831844, motion.flash("area"), 1e-9)
        motion.set("area", 1.0, duration = 480.0)
        assertEquals(.84375, motion.value("area"), 1e-9)
        motion.advance(0.0, immediate = true)
        assertEquals(1.0, motion.value("area"))
        assertEquals(1.0, motion.flash("area"))
        assertFalse(motion.moving)
    }

    @Test
    fun objectVisibilityUsesBothItsAreaAndItsHostAndFreeLightUsesAreaId() {
        val floor = MapModel("floor", "floor", "Пол")
        val tile = MapEntityRef(MapEntityKind.Tile, "tile")
        val obj = MapEntityRef(MapEntityKind.Object, "obj")
        val entries =
            mapOf(
                tile to MapSceneEntry(tile, floor, mapTransform(0.0, 0.0, 0.0, 0.0)),
                obj to MapSceneEntry(obj, floor, mapTransform(0.0, 0.0, 0.0, 0.0)),
            )
        val areas =
            listOf(
                buildJsonObject {
                    put("id", "parent")
                    put("hidden", false)
                    put("tileIds", JsonArray(listOf(JsonPrimitive("tile"))))
                    put("objectIds", JsonArray(emptyList()))
                },
                buildJsonObject {
                    put("id", "own")
                    put("hidden", false)
                    put("tileIds", JsonArray(emptyList()))
                    put("objectIds", JsonArray(listOf(JsonPrimitive("obj"))))
                },
            )
        val doc =
            newMapDocument()
                .with("areas", JsonArray(areas))
                .with(
                    "objects",
                    JsonArray(
                        listOf(
                            buildJsonObject {
                                put("id", "obj")
                                put(
                                    "placement",
                                    buildJsonObject {
                                        put("tileId", "tile")
                                        put("point", 0)
                                    },
                                )
                            }
                        )
                    ),
                )
        val motion = MapSurfaceMotion()
        motion.sync(MapContext(doc, emptyList()), entries)
        val hidden =
            doc.with(
                "areas",
                JsonArray(listOf(areas[0].with("hidden", JsonPrimitive(true)), areas[1])),
            )
        motion.sync(MapContext(hidden, emptyList()), entries)
        motion.advance(240.0, true)
        assertEquals(.56f, motion.style(tile).opacity, .0001f)
        assertEquals(.56f, motion.style(obj).opacity, .0001f)
        assertEquals(2.25f, motion.style(tile).brightness, .0001f)
        val light = buildJsonObject {
            put("id", "free")
            put("areaId", "parent")
        }
        assertEquals(.56f, motion.lightOpacity(light), .0001f)
        motion.advance(0.0, false)
        assertEquals(.12f, motion.style(obj).opacity, .0001f)
    }
}
