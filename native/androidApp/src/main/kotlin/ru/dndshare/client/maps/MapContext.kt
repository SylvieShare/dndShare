package ru.dndshare.client.maps

import kotlin.math.*
import kotlinx.serialization.json.*

internal fun JsonObject.array(key: String): JsonArray =
    get(key) as? JsonArray ?: JsonArray(emptyList())

internal fun JsonObject.ids(key: String) = array(key).map { it.jsonPrimitive.content }.toSet()

internal fun JsonArray.double(index: Int, default: Double = 0.0) =
    (getOrNull(index) as? JsonPrimitive)?.doubleOrNull ?: default

internal fun JsonObject.without(vararg keys: String) =
    JsonObject(toMutableMap().apply { keys.forEach(::remove) })

internal fun numbers(vararg values: Double) = JsonArray(values.map(::JsonPrimitive))

/** One indexed context per operation; resolving an attachment never scans the whole scene. */
class MapContext(val document: JsonObject, catalogue: Collection<MapModel>) {
    val models = catalogue.associateBy { it.uuid }
    val tiles = document.rows("tiles").associateBy { it.string("id") }
    val objects = document.rows("objects").associateBy { it.string("id") }
    val areas = document.rows("areas").associateBy { it.string("id") }
    val placements = mapPlacements(document, models)
    val tileAreas =
        document.rows("areas").flatMap { area -> area.ids("tileIds").map { it to area } }.toMap()
    val objectAreas =
        document.rows("areas").flatMap { area -> area.ids("objectIds").map { it to area } }.toMap()

    fun objectPose(row: JsonObject): MapPose {
        val anchor = row["placement"] as? JsonObject
        val tile = tiles[anchor?.string("tileId")]
        val model = models[tile?.string("modelId")]
        val point =
            model?.placementPoints?.getOrNull(anchor?.number("point")?.toInt() ?: -1) as? JsonObject
        return if (tile != null && model != null && point != null)
            mapSurface(tile, model, point, placements[tile.string("id")]?.elevation ?: 0.0)
        else MapPose(row.number("x"), row.number("y"), row.number("elevation", .44))
    }

    fun area(kind: String, id: String): JsonObject? =
        when (kind) {
            "tile" -> tileAreas[id]
            "object" ->
                objectAreas[id]
                    ?: tileAreas[(objects[id]?.get("placement") as? JsonObject)?.string("tileId")]
            else -> null
        }

    fun opacity(kind: String, id: String, ghost: Boolean = true): Float {
        val own = if (kind == "tile") tileAreas[id] else objectAreas[id]
        val parent =
            if (kind == "object")
                tileAreas[(objects[id]?.get("placement") as? JsonObject)?.string("tileId")]
            else null
        if (kind == "object" && (own?.flag("fog") == true || parent?.flag("fog") == true)) return 0f
        return if (own?.flag("hidden") == true || parent?.flag("hidden") == true)
            if (ghost) .12f else 0f
        else 1f
    }

    fun nearestSurface(point: MapPose, ignore: String = ""): Pair<JsonObject, MapPose>? {
        val occupied =
            objects.values
                .filter { it.string("id") != ignore }
                .mapNotNull { it["placement"] as? JsonObject }
                .toSet()
        return tiles.values
            .flatMap { tile ->
                val model = models[tile.string("modelId")] ?: return@flatMap emptyList()
                if (
                    !model.canStand ||
                        area("tile", tile.string("id"))?.let {
                            it.flag("hidden") || it.flag("fog")
                        } == true
                )
                    return@flatMap emptyList()
                model.placementPoints.mapIndexedNotNull { index, raw ->
                    val anchor = buildJsonObject {
                        put("tileId", tile.string("id"))
                        put("point", index)
                    }
                    if (anchor in occupied) null
                    else
                        anchor to
                            mapSurface(
                                tile,
                                model,
                                raw.jsonObject,
                                placements[tile.string("id")]?.elevation ?: 0.0,
                            )
                }
            }
            .minWithOrNull(
                compareBy<Pair<JsonObject, MapPose>> { (_, p) ->
                        (p.x - point.x).pow(2) + (p.y - point.y).pow(2)
                    }
                    .thenByDescending { it.second.elevation }
            )
    }
}

fun moveMapObject(
    document: JsonObject,
    models: Collection<MapModel>,
    id: String,
    point: MapPose,
): JsonObject {
    val context = MapContext(document, models)
    val row = requireNotNull(context.objects[id])
    val (anchor, target) =
        requireNotNull(context.nearestSurface(point, id)) {
            "На карте нет свободной точки размещения"
        }
    return mapReplace(
        document,
        "objects",
        row.with("placement", anchor)
            .with("x", JsonPrimitive(target.x))
            .with("y", JsonPrimitive(target.y)),
    )
}

fun mapAssignArea(document: JsonObject, areaId: String?, selected: Set<MapEntityRef>): JsonObject {
    require(areaId == null || document.rows("areas").any { it.string("id") == areaId })
    val tiles = selected.ids(MapEntityKind.Tile)
    val objects = selected.ids(MapEntityKind.Object)
    val lights = selected.ids(MapEntityKind.Light)
    return document
        .with(
            "areas",
            JsonArray(
                document.rows("areas").map { area ->
                    val target = area.string("id") == areaId
                    area
                        .with(
                            "tileIds",
                            JsonArray(
                                (area
                                        .array("tileIds")
                                        .map { it.jsonPrimitive.content }
                                        .filter { it !in tiles } +
                                        if (target) tiles else emptySet())
                                    .distinct()
                                    .map(::JsonPrimitive)
                            ),
                        )
                        .with(
                            "objectIds",
                            JsonArray(
                                (area
                                        .array("objectIds")
                                        .map { it.jsonPrimitive.content }
                                        .filter { it !in objects } +
                                        if (target) objects else emptySet())
                                    .distinct()
                                    .map(::JsonPrimitive)
                            ),
                        )
                }
            ),
        )
        .with(
            "lights",
            JsonArray(
                document.rows("lights").map { row ->
                    if (row.string("id") in lights && row["anchor"] !is JsonObject) {
                        if (areaId == null) row.without("areaId")
                        else row.with("areaId", JsonPrimitive(areaId))
                    } else row
                }
            ),
        )
}
