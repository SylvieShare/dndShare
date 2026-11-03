package ru.dndshare.client.maps.rendering

import kotlin.math.cos
import kotlin.math.sin
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*

data class MapSceneEntry(
    val ref: MapEntityRef,
    val model: MapModel,
    val matrix: FloatArray,
    val opacity: Float = 1f,
)

fun mapSceneEntries(document: JsonObject, models: Map<String, MapModel>): List<MapSceneEntry> {
    val placements = mapPlacements(document, models)
    val hiddenTiles =
        document
            .rows("areas")
            .filter { it.flag("hidden") }
            .flatMap { (it["tileIds"] as? JsonArray).orEmpty().map { it.jsonPrimitive.content } }
            .toSet()
    val hiddenObjects =
        document
            .rows("areas")
            .filter { it.flag("hidden") }
            .flatMap { (it["objectIds"] as? JsonArray).orEmpty().map { it.jsonPrimitive.content } }
            .toSet()
    val foggedTiles =
        document.rows("areas").filter { it.flag("fog") }.flatMap { it.ids("tileIds") }.toSet()
    val foggedObjects =
        document.rows("areas").filter { it.flag("fog") }.flatMap { it.ids("objectIds") }.toSet()
    return document.rows("tiles").mapNotNull { tile ->
        models[tile.string("modelId")]?.let { model ->
            val (w, h) = mapFootprint(tile, model)
            val transform =
                mapTransform(
                    tile.number("x") + w / 2.0,
                    tile.number("y") + h / 2.0,
                    (placements[tile.string("id")]?.elevation ?: 0.0) - model.mountDepth,
                    tile.number("rotation"),
                    mirrored = tile.flag("mirrored"),
                )
            val ox = model.placementOffset.getOrElse(0) { 0.0 }
            val oy = model.placementOffset.getOrElse(1) { 0.0 }
            transform[12] += (transform[0] * ox + transform[8] * oy).toFloat()
            transform[14] += (transform[2] * ox + transform[10] * oy).toFloat()
            MapSceneEntry(
                MapEntityRef(MapEntityKind.Tile, tile.string("id")),
                model,
                transform,
                if (tile.string("id") in hiddenTiles) .12f else 1f,
            )
        }
    } +
        document
            .rows("objects")
            .filter { it.string("id") !in foggedObjects }
            .mapNotNull { obj ->
                (models[obj.string("modelId")]
                        ?: if (obj.string("modelId").isBlank()) MapBuiltinProps.model(obj)
                        else null)
                    ?.let { model ->
                        val anchor = obj["placement"] as? JsonObject
                        val tile =
                            document.rows("tiles").find {
                                it.string("id") == anchor?.string("tileId")
                            }
                        val support = tile?.let { models[it.string("modelId")] }
                        if (tile?.string("id") in foggedTiles) return@mapNotNull null
                        val point =
                            support
                                ?.placementPoints
                                ?.getOrNull(anchor?.number("point")?.toInt() ?: -1) as? JsonObject
                        val pose =
                            if (tile != null && support != null && point != null)
                                mapSurface(
                                    tile,
                                    support,
                                    point,
                                    placements[tile.string("id")]?.elevation ?: 0.0,
                                )
                            else
                                MapPose(
                                    obj.number("x"),
                                    obj.number("y"),
                                    obj.number("elevation", .44),
                                )
                        MapSceneEntry(
                            MapEntityRef(MapEntityKind.Object, obj.string("id")),
                            model,
                            mapTransform(
                                pose.x,
                                pose.y,
                                pose.elevation,
                                obj.number("rotation"),
                                obj.number("scale", 1.0),
                            ),
                            if (
                                obj.string("id") in hiddenObjects ||
                                    tile?.string("id") in hiddenTiles
                            )
                                .12f
                            else 1f,
                        )
                    }
            }
}

fun mapTransform(
    x: Double,
    y: Double,
    elevation: Double,
    degrees: Double,
    scale: Double = 1.0,
    mirrored: Boolean = false,
): FloatArray {
    val angle = Math.toRadians(-degrees)
    val c = cos(angle).toFloat() * scale.toFloat()
    val s = sin(angle).toFloat() * scale.toFloat()
    val sign = if (mirrored) -1f else 1f
    return floatArrayOf(
        c * sign,
        0f,
        -s * sign,
        0f,
        0f,
        scale.toFloat(),
        0f,
        0f,
        s,
        0f,
        c,
        0f,
        x.toFloat(),
        elevation.toFloat(),
        y.toFloat(),
        1f,
    )
}
