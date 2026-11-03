package ru.dndshare.client.maps

import kotlinx.serialization.json.*

/**
 * Keep the full support structure for poses, while the renderer draws only the requested owners.
 */
fun mapPreviewSelection(
    document: JsonObject,
    ref: MapEntityRef,
): Pair<JsonObject, Set<MapEntityRef>> {
    val row = requireNotNull(ref.row(document))
    val tiles =
        if (ref.kind == MapEntityKind.Area) row.ids("tileIds")
        else if (ref.kind == MapEntityKind.Tile) setOf(ref.id) else emptySet()
    val objects =
        (if (ref.kind == MapEntityKind.Area) row.ids("objectIds")
        else if (ref.kind == MapEntityKind.Object) setOf(ref.id) else emptySet()) +
            document
                .rows("objects")
                .filter { (it["placement"] as? JsonObject)?.string("tileId") in tiles }
                .map { it.string("id") }
    val selected =
        tiles.map { MapEntityRef(MapEntityKind.Tile, it) }.toSet() +
            objects.map { MapEntityRef(MapEntityKind.Object, it) }
    val visible =
        document
            .with(
                "areas",
                JsonArray(
                    document.rows("areas").map {
                        it.with("hidden", JsonPrimitive(false)).with("fog", JsonPrimitive(false))
                    }
                ),
            )
            .with("lightingEnabled", JsonPrimitive(false))
    val lights =
        document
            .rows("lights")
            .filter {
                mapAnchorRef(it["anchor"] as? JsonObject) in selected ||
                    ref.kind == MapEntityKind.Area && it.string("areaId") == ref.id
            }
            .map { MapEntityRef(MapEntityKind.Light, it.string("id")) }
    return visible to (selected + lights)
}
