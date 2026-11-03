package ru.dndshare.client.maps

import kotlinx.serialization.json.*

fun Collection<MapEntityRef>.ids(kind: MapEntityKind) = filter {
    it.kind == kind
}
    .map { it.id }
    .toSet()

fun mapRemove(
    document: JsonObject,
    models: Map<String, MapModel>,
    selected: Set<MapEntityRef>,
): JsonObject {
    val tiles = mapDependentTiles(document, models, selected.ids(MapEntityKind.Tile))
    val objects =
        selected.ids(MapEntityKind.Object) +
            document
                .rows("objects")
                .filter {
                    (it["placement"] as? JsonObject)?.string("tileId") in tiles
                }
                .map { it.string("id") }
    val deleted =
        selected +
            tiles.map { MapEntityRef(MapEntityKind.Tile, it) } +
            objects.map { MapEntityRef(MapEntityKind.Object, it) }
    val areas = selected.ids(MapEntityKind.Area)
    return JsonObject(
        document.toMutableMap().apply {
            for (kind in MapEntityKind.entries) {
                if (kind.collection !in this) continue
                val rows =
                    document
                        .rows(kind.collection)
                        .filter { row ->
                            val ref = MapEntityRef(kind, row.string("id"))
                            val builtin =
                                kind == MapEntityKind.Light && row.string("builtinKey").isNotBlank()
                            (ref !in deleted || builtin) &&
                                mapAnchorRef(row["anchor"] as? JsonObject) !in deleted
                        }
                        .map { row ->
                            when (kind) {
                                MapEntityKind.Area ->
                                    row.with(
                                            "tileIds",
                                            JsonArray(
                                                row.array("tileIds").filter {
                                                    it.jsonPrimitive.content !in tiles
                                                }
                                            ),
                                        )
                                        .with(
                                            "objectIds",
                                            JsonArray(
                                                row.array("objectIds").filter {
                                                    it.jsonPrimitive.content !in objects
                                                }
                                            ),
                                        )
                                MapEntityKind.Light ->
                                    when {
                                        MapEntityRef(kind, row.string("id")) in selected &&
                                            row.string("builtinKey").isNotBlank() ->
                                            row.with("enabled", JsonPrimitive(false))
                                        row.string("areaId") in areas -> row.without("areaId")
                                        else -> row
                                    }
                                else -> row
                            }
                        }
                put(kind.collection, JsonArray(rows))
            }
        }
    )
}
