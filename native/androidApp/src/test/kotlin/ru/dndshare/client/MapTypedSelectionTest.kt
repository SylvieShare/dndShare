package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.model.WireJson

class MapTypedSelectionTest {
    private val models =
        listOf(
            MapModel(
                "floor-definition",
                "floor",
                "Пол",
                canStand = true,
                placementPoints =
                    JsonArray(
                        listOf(
                            buildJsonObject {
                                put("x", .5)
                                put("y", .5)
                                put("elevation", .44)
                            }
                        )
                    ),
            ),
            MapModel("prop-definition", "prop", "Объект", tileType = "object"),
        )

    private fun ref(kind: MapEntityKind) = MapEntityRef(kind, "same")

    private fun document(parent: String = "same"): JsonObject {
        fun tile(id: String, x: Int) = buildJsonObject {
            put("id", id)
            put("modelId", "floor")
            put("x", x)
            put("y", 2)
            put("level", 0)
            put("rotation", 0)
        }
        fun anchored(id: String, kind: String) = buildJsonObject {
            put("id", id)
            put(
                "anchor",
                buildJsonObject {
                    put("kind", kind)
                    put("id", "same")
                },
            )
        }
        return newMapDocument()
            .with("tiles", JsonArray(listOf(tile("same", 2), tile("other", 5))))
            .with(
                "objects",
                JsonArray(
                    listOf(
                        buildJsonObject {
                            put("id", "same")
                            put("kind", "chest")
                            put("modelId", "prop")
                            put("x", 2.5)
                            put("y", 2.5)
                            put("scale", 1)
                            put("rotation", 0)
                            put(
                                "placement",
                                buildJsonObject {
                                    put("tileId", parent)
                                    put("point", 0)
                                },
                            )
                        }
                    )
                ),
            )
            .with(
                "lights",
                JsonArray(
                    listOf(anchored("tile-light", "tile"), anchored("object-light", "object"))
                ),
            )
            .with(
                "decals",
                JsonArray(
                    listOf(anchored("tile-decal", "tile"), anchored("object-decal", "object"))
                ),
            )
            .with(
                "areas",
                JsonArray(
                    listOf(
                        buildJsonObject {
                            put("id", "first")
                            put("name", "Первая")
                            put("tileIds", JsonArray(listOf(JsonPrimitive("same"))))
                            put("objectIds", JsonArray(listOf(JsonPrimitive("same"))))
                        },
                        buildJsonObject {
                            put("id", "second")
                            put("name", "Вторая")
                            put("tileIds", JsonArray(emptyList()))
                            put("objectIds", JsonArray(emptyList()))
                        },
                    )
                ),
            )
    }

    @Test
    fun deletingObjectKeepsTileWithTheSameIdAndItsAttachments() {
        val result =
            mapRemove(document(), models.associateBy { it.uuid }, setOf(ref(MapEntityKind.Object)))
        assertEquals(2, result.rows("tiles").size)
        assertTrue(result.rows("objects").isEmpty())
        assertEquals(listOf("tile-light"), result.rows("lights").map { it.string("id") })
        assertEquals(listOf("tile-decal"), result.rows("decals").map { it.string("id") })
        assertEquals(setOf("same"), result.rows("areas").first().ids("tileIds"))
        assertTrue(result.rows("areas").first().ids("objectIds").isEmpty())
    }

    @Test
    fun deletingTileKeepsAnUnattachedObjectWithTheSameId() {
        val result =
            mapRemove(
                document("other"),
                models.associateBy { it.uuid },
                setOf(ref(MapEntityKind.Tile)),
            )
        assertEquals(listOf("other"), result.rows("tiles").map { it.string("id") })
        assertEquals("same", result.rows("objects").single().string("id"))
        assertEquals(listOf("object-light"), result.rows("lights").map { it.string("id") })
    }

    @Test
    fun assigningObjectToAnAreaDoesNotMoveTheOtherKind() {
        val result = mapAssignArea(document(), "second", setOf(ref(MapEntityKind.Object)))
        assertEquals(setOf("same"), result.rows("areas")[0].ids("tileIds"))
        assertTrue(result.rows("areas")[0].ids("objectIds").isEmpty())
        assertTrue(result.rows("areas")[1].ids("tileIds").isEmpty())
        assertEquals(setOf("same"), result.rows("areas")[1].ids("objectIds"))
    }

    @Test
    fun copiedOwnersKeepDistinctIdsAndCorrectDecalAndSurfaceBindings() {
        val doc = document()
        val copied = mapCopy(doc, models, setOf(ref(MapEntityKind.Tile), ref(MapEntityKind.Object)))
        val (result, selected) = mapPaste(doc, models, copied, MapPose(9.5, 8.5))
        val tileId = selected.single { it.kind == MapEntityKind.Tile }.id
        val objectId = selected.single { it.kind == MapEntityKind.Object }.id
        assertNotEquals(tileId, objectId)
        assertNotEquals("same", tileId)
        val obj = result.rows("objects").single { it.string("id") == objectId }
        assertEquals(tileId, obj["placement"]!!.jsonObject.string("tileId"))
        val newAnchors =
            result
                .rows("decals")
                .filter { it.string("id") !in setOf("tile-decal", "object-decal") }
                .map { mapAnchorRef(it["anchor"] as? JsonObject) }
                .toSet()
        assertEquals(selected, newAnchors)
    }

    @Test
    fun localToolAndSelectionRoundTripWithoutBecomingServerChanges() {
        val doc = document()
        val copied = mapCopy(doc, models, setOf(ref(MapEntityKind.Tile), ref(MapEntityKind.Object)))
        val ui =
            MapEditorUi(
                focus = MapFocus(listOf(ref(MapEntityKind.Tile), ref(MapEntityKind.Object))),
                tool = MapTool.BindLight("source"),
                clipboard = copied,
            )
        val original = MapWork(confirmed = BattleMap(id = "map", document = doc), ui = ui)
        val restored = WireJson.decodeFromString<MapWork>(WireJson.encodeToString(original))
        assertEquals(ui, restored.ui)
        assertFalse(restored.dirty)
        assertEquals(setOf("name", "document"), restored.current.content.keys)
    }

    @Test
    fun aSingleRectangularTileRotatesAtItsGridOrigin() {
        val wide = models[0].copy(width = 2)
        val result =
            mapTransformSelection(
                document("other"),
                mapOf("floor" to wide, "prop" to models[1]),
                setOf(ref(MapEntityKind.Tile)),
                false,
            )
        val tile = result.rows("tiles").first()
        assertEquals(2.0, tile.number("x"))
        assertEquals(2.0, tile.number("y"))
        assertEquals(90.0, tile.number("rotation"))
        assertEquals(0.0, result.rows("objects").single().number("rotation"))
    }
}
