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

fun mapRemove(
    document: JsonObject,
    models: Map<String, MapModel>,
    selected: Set<String>,
): JsonObject {
    val tiles = mapDependentTiles(document, models, selected)
    val objects =
        document
            .rows("objects")
            .filter {
                it.string("id") in selected ||
                    (it["placement"] as? JsonObject)?.string("tileId") in tiles
            }
            .map { it.string("id") }
            .toSet()
    val deleted = selected + tiles + objects
    return JsonObject(
        document.toMutableMap().apply {
            for (key in listOf("tiles", "objects", "lights", "decals", "cameras")) {
                if (key !in this) continue
                put(
                    key,
                    JsonArray(
                        document.rows(key).filter { row ->
                            row.string("id") !in deleted &&
                                (row["anchor"] as? JsonObject)?.string("id") !in deleted
                        }
                    ),
                )
            }
            put(
                "areas",
                JsonArray(
                    document
                        .rows("areas")
                        .filter { it.string("id") !in selected }
                        .map { area ->
                            JsonObject(
                                area.toMutableMap().apply {
                                    for (key in listOf("tileIds", "objectIds")) put(
                                        key,
                                        JsonArray(
                                            (area[key] as? JsonArray).orEmpty().filter {
                                                it.jsonPrimitive.content !in deleted
                                            }
                                        ),
                                    )
                                }
                            )
                        }
                ),
            )
        }
    )
}

fun mapPlaceTile(
    document: JsonObject,
    model: MapModel,
    point: MapPose,
    rotation: Int,
    level: Int,
): JsonObject {
    val tile = buildJsonObject {
        put("id", UUID.randomUUID().toString())
        put("modelId", model.uuid)
        put("x", floor(point.x).toInt())
        put("y", floor(point.y).toInt())
        put("rotation", rotation)
        put("level", level)
    }
    return document.with("tiles", JsonArray(document.rows("tiles") + tile))
}

fun mapPlaceObject(
    document: JsonObject,
    model: MapModel,
    models: Map<String, MapModel>,
    point: MapPose,
    rotation: Int,
): JsonObject {
    val placements = mapPlacements(document, models)
    val occupied = document.rows("objects").mapNotNull { it["placement"] as? JsonObject }
    val choices =
        document.rows("tiles").flatMap { tile ->
            val support = models[tile.string("modelId")] ?: return@flatMap emptyList()
            if (!support.canStand) return@flatMap emptyList()
            support.placementPoints.mapIndexedNotNull { index, raw ->
                val anchor = buildJsonObject {
                    put("tileId", tile.string("id"))
                    put("point", index)
                }
                if (anchor in occupied) null
                else
                    anchor to
                        mapSurface(
                            tile,
                            support,
                            raw.jsonObject,
                            placements[tile.string("id")]?.elevation ?: 0.0,
                        )
            }
        }
    val (anchor, target) =
        requireNotNull(
            choices.minByOrNull { (_, candidate) ->
                (candidate.x - point.x).pow(2) + (candidate.y - point.y).pow(2)
            }
        ) {
            "На карте нет свободных точек размещения"
        }
    val row = buildJsonObject {
        put("id", UUID.randomUUID().toString())
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
    selected: Set<String>,
    mirror: Boolean,
): JsonObject {
    val group =
        document.rows("tiles").filter {
            it.string("id") in mapDependentTiles(document, models, selected)
        }
    if (group.isEmpty())
        return document.with(
            "objects",
            JsonArray(
                document.rows("objects").map { row ->
                    if (row.string("id") in selected && !mirror)
                        row.with(
                            "rotation",
                            JsonPrimitive((row.number("rotation").toInt() + 90) % 360),
                        )
                    else row
                }
            ),
        )
    val left = group.minOf { it.number("x") }
    val top = group.minOf { it.number("y") }
    val right = group.maxOf {
        it.number("x") + mapFootprint(it, models.getValue(it.string("modelId"))).first
    }
    val bottom = group.maxOf {
        it.number("y") + mapFootprint(it, models.getValue(it.string("modelId"))).second
    }
    val px = (left + right) / 2
    val py = (top + bottom) / 2
    val changed = group.associate { tile ->
        val model = models.getValue(tile.string("modelId"))
        val (w, h) = mapFootprint(tile, model)
        val next =
            if (mirror) {
                val fields = tile.toMutableMap()
                fields["x"] = JsonPrimitive(round(left + right - tile.number("x") - w).toInt())
                fields["rotation"] = JsonPrimitive((360 - tile.number("rotation").toInt()) % 360)
                if (tile.flag("mirrored")) fields.remove("mirrored")
                else fields["mirrored"] = JsonPrimitive(true)
                JsonObject(fields)
            } else {
                val rotation = (tile.number("rotation").toInt() + 90) % 360
                tile
                    .with("rotation", JsonPrimitive(rotation))
                    .with(
                        "x",
                        JsonPrimitive(
                            round(px - (tile.number("y") + h / 2.0 - py) - h / 2.0).toInt()
                        ),
                    )
                    .with(
                        "y",
                        JsonPrimitive(
                            round(py + (tile.number("x") + w / 2.0 - px) - w / 2.0).toInt()
                        ),
                    )
            }
        tile.string("id") to next
    }
    return document.with(
        "tiles",
        JsonArray(document.rows("tiles").map { changed[it.string("id")] ?: it }),
    )
}
