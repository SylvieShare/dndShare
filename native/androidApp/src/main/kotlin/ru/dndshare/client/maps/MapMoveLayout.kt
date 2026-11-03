package ru.dndshare.client.maps

import kotlin.math.roundToInt
import kotlinx.serialization.json.*

data class MapMoveLayout(
    val tiles: List<JsonObject>,
    val objects: List<JsonObject>,
    val selected: Set<MapEntityRef>,
    val pivot: MapPose,
)

fun captureMapMove(
    document: JsonObject,
    catalogue: Collection<MapModel>,
    selected: Set<MapEntityRef>,
    hit: MapEntityRef,
): MapMoveLayout {
    val refs = if (hit in selected) selected else setOf(hit)
    val models = catalogue.associateBy { it.uuid }
    val tileIds = mapDependentTiles(document, models, refs.ids(MapEntityKind.Tile))
    val tiles = document.rows("tiles").filter { it.string("id") in tileIds }
    val objects =
        document.rows("objects").filter {
            it.string("id") in refs.ids(MapEntityKind.Object) ||
                (it["placement"] as? JsonObject)?.string("tileId") in tileIds
        }
    require(tiles.isNotEmpty() || objects.isNotEmpty())
    val context = MapContext(document, catalogue)
    val posed = objects.map { row ->
        val point = context.objectPose(row)
        row.with("x", JsonPrimitive(point.x)).with("y", JsonPrimitive(point.y))
    }
    return MapMoveLayout(tiles, posed, refs, mapGroupPivot(tiles, posed, models))
}

fun moveMapLayout(
    document: JsonObject,
    catalogue: Collection<MapModel>,
    layout: MapMoveLayout,
    deltaX: Double,
    deltaY: Double,
    deltaLevel: Int = 0,
): JsonObject {
    val models = catalogue.associateBy { it.uuid }
    val dx = if (layout.tiles.isNotEmpty()) deltaX.roundToInt().toDouble() else deltaX
    val dy = if (layout.tiles.isNotEmpty()) deltaY.roundToInt().toDouble() else deltaY
    val tiles = layout.tiles.associateBy { it.string("id") }
    var next =
        document.with(
            "tiles",
            JsonArray(
                document.rows("tiles").map { current ->
                    val moved = tiles[current.string("id")] ?: return@map current
                    var row =
                        current
                            .with("x", JsonPrimitive((moved.number("x") + dx).roundToInt()))
                            .with("y", JsonPrimitive((moved.number("y") + dy).roundToInt()))
                            .with("rotation", moved["rotation"] ?: JsonPrimitive(0))
                            .with(
                                "level",
                                JsonPrimitive(moved.number("level").toInt() + deltaLevel),
                            )
                    row =
                        if (moved.flag("mirrored")) row.with("mirrored", JsonPrimitive(true))
                        else row.without("mirrored")
                    row
                }
            ),
        )
    mapPlacements(next, models)
    val external =
        layout.objects.filter { (it["placement"] as? JsonObject)?.string("tileId") !in tiles }
    val currentObjects = document.rows("objects").associateBy { it.string("id") }
    val movingIds = external.map { it.string("id") }.toSet()
    next =
        next.with(
            "objects",
            JsonArray(
                next
                    .rows("objects")
                    .filter { it.string("id") !in movingIds }
                    .map { row ->
                        val source = layout.objects.find { it.string("id") == row.string("id") }
                        if (source == null) row
                        else row.with("rotation", source["rotation"] ?: JsonPrimitive(0))
                    }
            ),
        )
    for (source in external) {
        val original = currentObjects[source.string("id")] ?: continue
        val row =
            original
                .without("placement")
                .with("x", JsonPrimitive(source.number("x") + dx))
                .with("y", JsonPrimitive(source.number("y") + dy))
                .with("rotation", source["rotation"] ?: JsonPrimitive(0))
        require(
            row.number("x") in 0.0..next.number("width") &&
                row.number("y") in 0.0..next.number("height")
        ) {
            "Объект должен находиться внутри карты"
        }
        next = next.with("objects", JsonArray(next.rows("objects") + row))
        if (row.string("modelId").isNotBlank())
            next =
                moveMapObject(
                    next,
                    catalogue,
                    row.string("id"),
                    MapPose(row.number("x"), row.number("y")),
                )
    }
    return normalizeMapDocument(next, catalogue)
}

fun transformMapMove(
    layout: MapMoveLayout,
    catalogue: Collection<MapModel>,
    mirror: Boolean,
): MapMoveLayout {
    val clipboard =
        MapClipboard(
            newMapDocument()
                .with("tiles", JsonArray(layout.tiles))
                .with("objects", JsonArray(layout.objects)),
            layout.selected,
        )
    val transformed = transformMapClipboard(clipboard, catalogue, layout.pivot, mirror).document
    return layout.copy(tiles = transformed.rows("tiles"), objects = transformed.rows("objects"))
}
