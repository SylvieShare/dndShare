package ru.dndshare.client.maps

import kotlinx.serialization.json.*

@kotlinx.serialization.Serializable
data class MapPose(val x: Double, val y: Double, val elevation: Double = 0.0)

data class MapSupport(val elevation: Double, val parents: Set<String>)

fun mapFootprint(tile: JsonObject, model: MapModel): Pair<Int, Int> =
    if (tile.number("rotation").toInt() % 180 != 0) model.height to model.width
    else model.width to model.height

/** Same spatial index and support rules are used for validation and placement previews. */
fun mapPlacements(document: JsonObject, models: Map<String, MapModel>): Map<String, MapSupport> =
    MapStructureContext(document, models).placements

fun mapSurface(tile: JsonObject, model: MapModel, point: JsonObject, elevation: Double): MapPose {
    var x = point.number("x")
    var y = point.number("y")
    if (tile.flag("mirrored")) x = model.width - x
    when (tile.number("rotation").toInt()) {
        90 -> {
            val old = x
            x = model.height - y
            y = old
        }
        180 -> {
            x = model.width - x
            y = model.height - y
        }
        270 -> {
            val old = x
            x = y
            y = model.width - old
        }
    }
    return MapPose(
        tile.number("x") + x,
        tile.number("y") + y,
        elevation + point.number("elevation") - model.mountDepth,
    )
}

fun mapDependentTiles(
    document: JsonObject,
    models: Map<String, MapModel>,
    selected: Set<String>,
): Set<String> {
    val placements = mapPlacements(document, models)
    val removed = selected.toMutableSet()
    do {
        val count = removed.size
        placements.forEach { (id, pose) -> if (pose.parents.any { it in removed }) removed += id }
    } while (count != removed.size)
    return removed
}
