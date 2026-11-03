package ru.dndshare.client.maps

import java.util.UUID
import kotlin.math.roundToInt
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*

@Serializable data class MapClipboard(val document: JsonObject, val selected: Set<MapEntityRef>)

fun mapCopy(
    document: JsonObject,
    catalogue: Collection<MapModel>,
    selected: Set<MapEntityRef>,
): MapClipboard {
    val context = MapContext(document, catalogue)
    val tileIds = selected.ids(MapEntityKind.Tile)
    val tiles = document.rows("tiles").filter { it.string("id") in tileIds }
    val objectIds = selected.ids(MapEntityKind.Object)
    val objects =
        document
            .rows("objects")
            .filter { row ->
                val parent = (row["placement"] as? JsonObject)?.string("tileId")
                val hidden =
                    context.objectAreas[row.string("id")]?.flag("hidden") == true ||
                        context.tileAreas[parent]?.flag("hidden") == true
                row.string("id") in objectIds || !hidden && parent in tileIds
            }
            .map { row ->
                if ((row["placement"] as? JsonObject)?.string("tileId") !in tileIds) {
                    val pose = context.objectPose(row)
                    row.without("placement")
                        .with("x", JsonPrimitive(pose.x))
                        .with("y", JsonPrimitive(pose.y))
                        .with("elevation", JsonPrimitive(pose.elevation))
                } else row
            }
    val owners =
        tiles.map { MapEntityRef(MapEntityKind.Tile, it.string("id")) }.toSet() +
            objects.map { MapEntityRef(MapEntityKind.Object, it.string("id")) }
    if (owners.isEmpty()) {
        val lights =
            selected
                .filter { it.kind == MapEntityKind.Light }
                .mapNotNull { it.row(document) }
                .map { source ->
                    val pose = mapLightPose(source, context)
                    pose.source
                        .without("anchor", "areaId", "builtinKey", "overrides")
                        .with("height", JsonPrimitive(pose.height))
                        .with("x", JsonPrimitive(pose.point.x))
                        .with("y", JsonPrimitive(pose.point.y))
                        .with("elevation", JsonPrimitive(pose.point.elevation))
                        .with("offset", numbers(0.0, 0.0))
                }
        require(lights.isNotEmpty()) { "Выберите плитки, объекты или источник света" }
        return MapClipboard(
            newMapDocument().with("lights", JsonArray(lights)),
            lights.map { MapEntityRef(MapEntityKind.Light, it.string("id")) }.toSet(),
        )
    }
    val rows = tiles + objects
    val x = rows.minOf { it.number("x") }
    val y = rows.minOf { it.number("y") }
    val level = tiles.minOfOrNull { it.number("level") } ?: 0.0
    fun relative(row: JsonObject) =
        row.with("x", JsonPrimitive(row.number("x") - x))
            .with("y", JsonPrimitive(row.number("y") - y))
    val copy =
        document
            .with(
                "tiles",
                JsonArray(
                    tiles.map {
                        relative(it)
                            .with("level", JsonPrimitive((it.number("level") - level).toInt()))
                    }
                ),
            )
            .with("objects", JsonArray(objects.map(::relative)))
            .with("areas", JsonArray(emptyList()))
            .with("zones", JsonArray(emptyList()))
            .with("cameras", JsonArray(emptyList()))
            .with(
                "decals",
                JsonArray(
                    document.rows("decals").filter {
                        mapAnchorRef(it["anchor"] as? JsonObject) in owners
                    }
                ),
            )
            .with(
                "lights",
                JsonArray(
                    document.rows("lights").filter {
                        it.string("builtinKey").isNotBlank() &&
                            mapAnchorRef(it["anchor"] as? JsonObject) in owners
                    }
                ),
            )
    return MapClipboard(copy, owners)
}

fun mapPaste(
    document: JsonObject,
    catalogue: Collection<MapModel>,
    clipboard: MapClipboard,
    point: MapPose,
    level: Int = 0,
    newId: (MapEntityRef) -> String = { UUID.randomUUID().toString() },
    pivotOverride: MapPose? = null,
): Pair<JsonObject, Set<MapEntityRef>> {
    val original = clipboard.document
    val models = catalogue.associateBy { it.uuid }
    val tiles = original.rows("tiles")
    val objects = original.rows("objects")
    if (tiles.isEmpty() && objects.isEmpty()) {
        val sources = original.rows("lights")
        require(
            sources.isNotEmpty() &&
                document.rows("lights").count { it.string("builtinKey").isBlank() } +
                    sources.size <= 32
        ) {
            "На карте может быть до 32 ручных источников"
        }
        val lights = sources.map {
            it.with("id", JsonPrimitive(newId(MapEntityRef(MapEntityKind.Light, it.string("id")))))
                .with("x", JsonPrimitive(point.x))
                .with("y", JsonPrimitive(point.y))
                .with("elevation", JsonPrimitive(point.elevation))
        }
        return normalizeMapDocument(
            document.with("lights", JsonArray(document.rows("lights") + lights)),
            catalogue,
        ) to lights.map { MapEntityRef(MapEntityKind.Light, it.string("id")) }.toSet()
    }
    val pivot = pivotOverride ?: mapGroupPivot(tiles, objects, models)
    val root = tiles.minByOrNull { it.number("level") }
    val anchor =
        if (tiles.size == 1 && objects.isEmpty()) {
            val size = mapFootprint(root!!, models.getValue(root.string("modelId")))
            MapPose(root.number("x") + size.first / 2.0, root.number("y") + size.second / 2.0)
        } else pivot
    val dx =
        if (tiles.isNotEmpty()) (point.x - anchor.x).roundToInt().toDouble() else point.x - anchor.x
    val dy =
        if (tiles.isNotEmpty()) (point.y - anchor.y).roundToInt().toDouble() else point.y - anchor.y
    val mapping =
        clipboard.selected
            .filter { it.kind == MapEntityKind.Tile || it.kind == MapEntityKind.Object }
            .associateWith(newId)
    val copiedTiles = tiles.map { row ->
        row.with(
                "id",
                JsonPrimitive(mapping.getValue(MapEntityRef(MapEntityKind.Tile, row.string("id")))),
            )
            .with("x", JsonPrimitive((row.number("x") + dx).roundToInt()))
            .with("y", JsonPrimitive((row.number("y") + dy).roundToInt()))
            .with("level", JsonPrimitive(row.number("level").toInt() + level))
    }
    var next = document.with("tiles", JsonArray(document.rows("tiles") + copiedTiles))
    mapPlacements(next, models)
    for (row in objects) {
        val id = mapping.getValue(MapEntityRef(MapEntityKind.Object, row.string("id")))
        val placement = row["placement"] as? JsonObject
        val parent =
            placement?.string("tileId")?.let { mapping[MapEntityRef(MapEntityKind.Tile, it)] }
        var obj =
            row.with("id", JsonPrimitive(id))
                .with("x", JsonPrimitive(row.number("x") + dx))
                .with("y", JsonPrimitive(row.number("y") + dy))
        obj =
            if (parent != null)
                obj.with("placement", placement!!.with("tileId", JsonPrimitive(parent)))
            else obj.without("placement")
        next = next.with("objects", JsonArray(next.rows("objects") + obj))
        if (parent == null && obj.string("modelId").isNotBlank())
            next = moveMapObject(next, catalogue, id, MapPose(obj.number("x"), obj.number("y")))
    }
    for (key in listOf("lights", "decals")) {
        val copied =
            original.rows(key).mapNotNull { row ->
                val anchorRef = mapAnchorRef(row["anchor"] as? JsonObject) ?: return@mapNotNull null
                val owner = mapping[anchorRef] ?: return@mapNotNull null
                row.with(
                        "id",
                        JsonPrimitive(
                            newId(
                                MapEntityRef(
                                    if (key == "lights") MapEntityKind.Light
                                    else MapEntityKind.Decal,
                                    row.string("id"),
                                )
                            )
                        ),
                    )
                    .with("anchor", row["anchor"]!!.jsonObject.with("id", JsonPrimitive(owner)))
            }
        if (copied.isNotEmpty()) next = next.with(key, JsonArray(next.rows(key) + copied))
    }
    return normalizeMapDocument(next, catalogue) to
        mapping.map { (ref, id) -> MapEntityRef(ref.kind, id) }.toSet()
}
