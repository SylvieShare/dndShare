package ru.dndshare.client.maps

import kotlin.math.*
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.rendering.MapCamera

data class MapPlacementPoint(val point: MapPose, val level: Int, val distance: Double = 0.0)

data class MapSupportBounds(val x: Int, val y: Int, val width: Int, val height: Int)

/** Project the pointer onto actual support planes, ordered from the camera to the ground. */
fun mapPlacementPoints(
    context: MapStructureContext,
    model: MapModel,
    camera: MapCamera,
    px: Double,
    py: Double,
    viewportWidth: Int,
    viewportHeight: Int,
    rotation: Int = 0,
    ignored: Set<String> = emptySet(),
    grabOffset: MapPose = MapPose(0.0, 0.0),
    grabHeight: Double? = null,
    levelOffset: Int = 0,
    supportBounds: MapSupportBounds? = null,
    hidden: Set<String> = emptySet(),
): List<MapPlacementPoint> {
    val footprint = mapFootprint(buildJsonObject { put("rotation", rotation) }, model)
    val planes =
        context.sockets
            .filter { (cell, slot) ->
                cell.level + levelOffset < 16 && slot.parent !in ignored && slot.parent !in hidden
            }
            .map { (cell, slot) -> cell.level to slot.elevation }
            .distinct()
    val eye = camera.eye
    val found = mutableListOf<MapPlacementPoint>()
    for ((level, elevation) in planes) {
        val hit =
            camera.world(px, py, viewportWidth, viewportHeight, elevation + (grabHeight ?: 0.0))
        val forward =
            (hit.x - eye[0]) * (camera.x - eye[0]) +
                (hit.elevation - eye[1]) * (camera.elevation - eye[1]) +
                (hit.y - eye[2]) * (camera.y - eye[2])
        if (forward < 0) continue
        val x = (hit.x - grabOffset.x - footprint.first / 2.0).roundToInt()
        val y = (hit.y - grabOffset.y - footprint.second / 2.0).roundToInt()
        val sx = x + (supportBounds?.x ?: 0)
        val sy = y + (supportBounds?.y ?: 0)
        var supported = false
        for (cy in sy until sy + (supportBounds?.height ?: footprint.second)) for (cx in
            sx until sx + (supportBounds?.width ?: footprint.first)) {
            val slot = context.sockets[MapStructureCell(cx, cy, level)]
            if (slot != null && slot.parent !in ignored && abs(slot.elevation - elevation) < .015)
                supported = true
        }
        if (supported)
            found +=
                MapPlacementPoint(
                    hit.copy(elevation = elevation),
                    level + levelOffset,
                    sqrt(
                        (hit.x - eye[0]).pow(2) +
                            (hit.y - eye[2]).pow(2) +
                            (hit.elevation - eye[1]).pow(2)
                    ),
                )
    }
    return found.sortedBy { it.distance } +
        MapPlacementPoint(
            camera.world(px, py, viewportWidth, viewportHeight, grabHeight ?: .44),
            levelOffset,
        )
}

data class MapSurfacePoint(val anchor: JsonObject, val point: MapPose)

/** Use screen distance: overlapping x/y points on different floors are distinct targets. */
fun mapSurfacePointInView(
    context: MapContext,
    camera: MapCamera,
    px: Double,
    py: Double,
    width: Int,
    height: Int,
    ignored: Set<String> = emptySet(),
    hidden: Set<String> = emptySet(),
): MapSurfacePoint? {
    val used =
        context.objects.values
            .filter { it.string("id") !in ignored }
            .mapNotNull { it["placement"] as? JsonObject }
            .toSet()
    var best: MapSurfacePoint? = null
    var distance = Double.POSITIVE_INFINITY
    for (tile in context.tiles.values) {
        if (tile.string("id") in hidden) continue
        val model = context.models[tile.string("modelId")] ?: continue
        if (!model.canStand) continue
        for ((index, raw) in model.placementPoints.withIndex()) {
            val anchor = buildJsonObject {
                put("tileId", tile.string("id"))
                put("point", index)
            }
            if (anchor in used) continue
            val point =
                mapSurface(
                    tile,
                    model,
                    raw.jsonObject,
                    context.placements[tile.string("id")]?.elevation ?: 0.0,
                )
            val screen = camera.project(point, width, height)
            val next = hypot(screen.first - px, screen.second - py)
            if (next < distance) {
                distance = next
                best = MapSurfacePoint(anchor, point)
            }
        }
    }
    return best
}
