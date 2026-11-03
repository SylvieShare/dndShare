package ru.dndshare.client.maps

import kotlin.math.*
import kotlinx.serialization.json.*

/** Resolve a held group against support planes while preserving its original grab point. */
fun placeMapMove(
    document: JsonObject,
    catalogue: List<MapModel>,
    layout: MapMoveLayout,
    hit: MapEntityRef,
    grip: MapPose,
    view: MapPlacementView?,
    point: MapPose,
): JsonObject {
    val models = catalogue.associateBy { it.uuid }
    if (layout.tiles.isNotEmpty()) {
        val anchor = layout.tiles.find { it.string("id") == hit.id } ?: layout.tiles.first()
        val root = layout.tiles.minBy { it.number("level") }
        val model = models.getValue(anchor.string("modelId"))
        val size = mapFootprint(anchor, model)
        val rootSize = mapFootprint(root, models.getValue(root.string("modelId")))
        val offset =
            MapPose(
                grip.x - anchor.number("x") - size.first / 2.0,
                grip.y - anchor.number("y") - size.second / 2.0,
            )
        val ignored = layout.tiles.map { it.string("id") }.toSet()
        val context = MapStructureContext(document, models)
        val rootElevation = context.placements[root.string("id")]?.elevation ?: 0.0
        val candidates =
            if (view == null) listOf(MapPlacementPoint(point, anchor.number("level").toInt()))
            else
                mapPlacementPoints(
                    context,
                    model,
                    view.camera,
                    view.x,
                    view.y,
                    view.width,
                    view.height,
                    anchor.number("rotation").toInt(),
                    ignored,
                    offset,
                    max(0.0, grip.elevation - rootElevation),
                    anchor.number("level").toInt() - root.number("level").toInt(),
                    MapSupportBounds(
                        (root.number("x") - anchor.number("x")).toInt(),
                        (root.number("y") - anchor.number("y")).toInt(),
                        rootSize.first,
                        rootSize.second,
                    ),
                )
        for (candidate in candidates) {
            val tile =
                anchor
                    .with("x", JsonPrimitive(candidate.point.x - offset.x - size.first / 2.0))
                    .with("y", JsonPrimitive(candidate.point.y - offset.y - size.second / 2.0))
                    .with("level", JsonPrimitive(candidate.level))
            val nearest =
                nearestMapTilePlacement(
                    document,
                    tile,
                    models,
                    ignored,
                    group = layout.tiles,
                    origin = anchor,
                ) ?: continue
            return moveMapLayout(
                document,
                catalogue,
                layout,
                nearest.tile.number("x") - anchor.number("x"),
                nearest.tile.number("y") - anchor.number("y"),
                candidate.level - anchor.number("level").toInt(),
            )
        }
        error("Для группы нет допустимого положения рядом с указателем")
    }
    val source = layout.objects.singleOrNull()
    if (source != null && source.string("modelId").isNotBlank() && view != null) {
        val context = MapContext(document, catalogue)
        val target =
            requireNotNull(
                mapSurfacePointInView(
                    context,
                    view.camera,
                    view.x,
                    view.y,
                    view.width,
                    view.height,
                    setOf(source.string("id")),
                )
            ) {
                "Нет свободной точки размещения"
            }
        val current =
            requireNotNull(MapEntityRef(MapEntityKind.Object, source.string("id")).row(document))
        return normalizeMapDocument(
            mapReplace(
                document,
                "objects",
                current
                    .with("placement", target.anchor)
                    .with("x", JsonPrimitive(target.point.x))
                    .with("y", JsonPrimitive(target.point.y))
                    .with("rotation", source["rotation"] ?: JsonPrimitive(0)),
            ),
            catalogue,
        )
    }
    val projected =
        view?.let { it.camera.world(it.x, it.y, it.width, it.height, grip.elevation) } ?: point
    var dx = projected.x - grip.x
    var dy = projected.y - grip.y
    if (source != null) {
        val x =
            ((source.number("x") + dx - .5).roundToInt() + .5).coerceIn(
                .5,
                document.number("width") - .5,
            )
        val y =
            ((source.number("y") + dy - .5).roundToInt() + .5).coerceIn(
                .5,
                document.number("height") - .5,
            )
        dx = x - source.number("x")
        dy = y - source.number("y")
    }
    return moveMapLayout(document, catalogue, layout, dx, dy)
}
