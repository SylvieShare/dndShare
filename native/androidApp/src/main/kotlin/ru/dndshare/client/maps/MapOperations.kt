package ru.dndshare.client.maps

import java.util.UUID
import kotlin.math.*
import kotlinx.serialization.json.*

fun mapReplace(document: JsonObject, collection: String, row: JsonObject): JsonObject =
    document.with(
        collection,
        JsonArray(
            document.rows(collection).map { if (it.string("id") == row.string("id")) row else it }
        ),
    )

fun mapPlaceTile(
    document: JsonObject,
    model: MapModel,
    point: MapPose,
    rotation: Int,
    level: Int,
    id: String = UUID.randomUUID().toString(),
    mirrored: Boolean = false,
): JsonObject {
    val footprint = mapFootprint(buildJsonObject { put("rotation", rotation) }, model)
    val tile = buildJsonObject {
        put("id", id)
        put("modelId", model.uuid)
        put("x", (point.x - footprint.first / 2.0).roundToInt())
        put("y", (point.y - footprint.second / 2.0).roundToInt())
        put("rotation", rotation)
        put("level", level)
        if (mirrored) put("mirrored", true)
    }
    return document.with("tiles", JsonArray(document.rows("tiles") + tile))
}

fun mapPlaceObject(
    document: JsonObject,
    model: MapModel,
    models: Map<String, MapModel>,
    point: MapPose,
    rotation: Int,
    id: String = UUID.randomUUID().toString(),
): JsonObject {
    val (anchor, target) =
        requireNotNull(MapContext(document, models.values).nearestSurface(point)) {
            "На карте нет свободных точек размещения"
        }
    val row = buildJsonObject {
        put("id", id)
        put("modelId", model.uuid)
        put("kind", "chest")
        put("x", target.x)
        put("y", target.y)
        put("scale", 1)
        put("rotation", rotation)
        put("open", false)
        put("placement", anchor)
    }
    return document.with("objects", JsonArray(document.rows("objects") + row))
}

fun mapTransformSelection(
    document: JsonObject,
    models: Map<String, MapModel>,
    selected: Set<MapEntityRef>,
    mirror: Boolean,
    pivot: MapPose? = null,
): JsonObject {
    val tileIds = mapDependentTiles(document, models, selected.ids(MapEntityKind.Tile))
    val tiles = document.rows("tiles").filter { it.string("id") in tileIds }
    val transformed =
        when {
            mirror -> mapMirrorGroup(tiles, models)
            tiles.size == 1 ->
                tiles.map {
                    it.with("rotation", JsonPrimitive((it.number("rotation").toInt() + 90) % 360))
                }
            tiles.isNotEmpty() ->
                mapRotateGroup(
                        tiles,
                        emptyList(),
                        models,
                        pivot ?: mapGroupPivot(tiles, emptyList(), models),
                    )
                    .first
            else -> emptyList()
        }.associateBy { it.string("id") }
    var result =
        document.with(
            "tiles",
            JsonArray(document.rows("tiles").map { transformed[it.string("id")] ?: it }),
        )
    if (!mirror) {
        val objectIds = selected.ids(MapEntityKind.Object)
        result =
            result
                .with(
                    "objects",
                    JsonArray(
                        result.rows("objects").map { row ->
                            if (
                                row.string("id") in objectIds ||
                                    (row["placement"] as? JsonObject)?.string("tileId") in tileIds
                            )
                                row.with(
                                    "rotation",
                                    JsonPrimitive((row.number("rotation") + 90) % 360),
                                )
                            else row
                        }
                    ),
                )
                .with(
                    "decals",
                    JsonArray(
                        result.rows("decals").map { row ->
                            if (MapEntityRef(MapEntityKind.Decal, row.string("id")) in selected)
                                row.with(
                                    "rotation",
                                    JsonPrimitive((row.number("rotation") + 90) % 360),
                                )
                            else row
                        }
                    ),
                )
    }
    mapPlacements(result, models)
    return result
}
