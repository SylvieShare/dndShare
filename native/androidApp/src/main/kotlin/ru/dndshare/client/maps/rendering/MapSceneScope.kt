package ru.dndshare.client.maps.rendering

import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*

internal fun mapSceneScope(document: JsonObject, refs: Set<MapEntityRef>?): JsonObject {
    if (refs == null) return document
    fun included(row: JsonObject, kind: MapEntityKind) =
        MapEntityRef(kind, row.string("id")) in refs ||
            mapAnchorRef(row["anchor"] as? JsonObject) in refs
    return document
        .with(
            "lights",
            JsonArray(document.rows("lights").filter { included(it, MapEntityKind.Light) }),
        )
        .with(
            "decals",
            JsonArray(document.rows("decals").filter { included(it, MapEntityKind.Decal) }),
        )
}
