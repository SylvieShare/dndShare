package ru.dndshare.client.maps.rendering

import ru.dndshare.client.maps.*

internal data class MapLoadingFootprint(
    val ref: MapEntityRef,
    val matrix: FloatArray,
    val opacity: Float,
)

/** Same footprint as loadingPreview.js; model offsets belong to geometry, not this plane. */
internal fun mapLoadingFootprint(entry: MapSceneEntry, context: MapContext): MapLoadingFootprint? {
    val row = entry.ref.row(context.document) ?: return null
    val opacity = context.opacity(entry.ref.kind.wire, entry.ref.id)
    if (opacity <= .001f) return null
    val matrix =
        when (entry.ref.kind) {
            MapEntityKind.Tile -> {
                val (width, height) = mapFootprint(row, entry.model)
                mapTransform(
                        row.number("x") + width / 2.0,
                        row.number("y") + height / 2.0,
                        (context.placements[entry.ref.id]?.elevation ?: 0.0) + .24,
                        0.0,
                    )
                    .also {
                        it[0] *= width.toFloat()
                        it[10] *= height.toFloat()
                    }
            }
            MapEntityKind.Object -> {
                val pose = context.objectPose(row)
                mapTransform(
                    pose.x,
                    pose.y,
                    pose.elevation + .24,
                    row.number("rotation"),
                    .76 * row.number("scale", 1.0),
                )
            }
            else -> return null
        }
    return MapLoadingFootprint(entry.ref, matrix, opacity)
}
