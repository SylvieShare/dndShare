package ru.dndshare.client.maps

import java.util.UUID
import kotlin.math.floor
import kotlinx.serialization.json.*

data class MapClipboard(val document: JsonObject, val selected: Set<String>)

fun mapCopy(
    document: JsonObject,
    catalogue: Collection<MapModel>,
    selected: Set<String>,
): MapClipboard {
    val context = MapContext(document, catalogue)
    val tileIds = mapDependentTiles(document, context.models, selected)
    val tiles = document.rows("tiles").filter { it.string("id") in tileIds }
    val base = tiles.minOfOrNull { it.number("level").toInt() } ?: 0
    val objects =
        document
            .rows("objects")
            .filter {
                it.string("id") in selected ||
                    (it["placement"] as? JsonObject)?.string("tileId") in tileIds
            }
            .map { row ->
                val anchor = row["placement"] as? JsonObject
                if (anchor != null && anchor.string("tileId") !in tileIds)
                    context.objectPose(row).let { pose ->
                        row.without("placement")
                            .with("x", JsonPrimitive(pose.x))
                            .with("y", JsonPrimitive(pose.y))
                            .with("elevation", JsonPrimitive(pose.elevation))
                    }
                else row
            }
    val owners = tiles.map { it.string("id") }.toSet() + objects.map { it.string("id") }
    var copy =
        document
            .with(
                "tiles",
                JsonArray(
                    tiles.map { it.with("level", JsonPrimitive(it.number("level").toInt() - base)) }
                ),
            )
            .with("objects", JsonArray(objects))
            .with("areas", JsonArray(emptyList()))
            .with("zones", JsonArray(emptyList()))
    for (key in listOf("lights", "decals")) copy =
        copy.with(
            key,
            JsonArray(
                document.rows(key).filter {
                    val anchor = it["anchor"] as? JsonObject
                    anchor?.string("id") in owners || it.string("id") in selected
                }
            ),
        )
    return MapClipboard(copy, owners + selected)
}

fun mapPaste(
    document: JsonObject,
    catalogue: Collection<MapModel>,
    clipboard: MapClipboard,
    point: MapPose,
    level: Int = 0,
): Pair<JsonObject, Set<String>> {
    val original = clipboard.document
    val models = catalogue.associateBy { it.uuid }
    val chosen = mapDependentTiles(original, models, clipboard.selected)
    val tiles = original.rows("tiles").filter { it.string("id") in chosen }
    val objects =
        original.rows("objects").filter {
            it.string("id") in clipboard.selected ||
                (it["placement"] as? JsonObject)?.string("tileId") in chosen
        }
    if (tiles.isEmpty() && objects.isEmpty()) {
        val lights =
            original
                .rows("lights")
                .filter { it.string("id") in clipboard.selected }
                .map {
                    it.without("anchor", "areaId", "builtinKey", "overrides")
                        .with("id", JsonPrimitive(UUID.randomUUID().toString()))
                        .with("x", JsonPrimitive(point.x))
                        .with("y", JsonPrimitive(point.y))
                        .with("elevation", JsonPrimitive(point.elevation))
                        .with("offset", numbers(0.0, 0.0))
                }
        require(lights.isNotEmpty()) { "Нечего вставлять" }
        return normalizeMapDocument(
            document.with("lights", JsonArray(document.rows("lights") + lights)),
            catalogue,
        ) to lights.map { it.string("id") }.toSet()
    }
    val rows = tiles + objects
    val left = rows.minOf { it.number("x") }
    val top = rows.minOf { it.number("y") }
    val dx = floor(point.x) - left
    val dy = floor(point.y) - top
    val base = tiles.minOfOrNull { it.number("level").toInt() } ?: 0
    val owners = rows.associate { it.string("id") to UUID.randomUUID().toString() }
    val selectedTiles = tiles.map { it.string("id") }.toSet()
    fun copy(row: JsonObject): JsonObject {
        var result =
            row.with("id", JsonPrimitive(owners.getValue(row.string("id"))))
                .with("x", JsonPrimitive(row.number("x") + dx))
                .with("y", JsonPrimitive(row.number("y") + dy))
        val anchor = row["placement"] as? JsonObject
        if (anchor != null && anchor.string("tileId") in owners)
            result =
                result.with(
                    "placement",
                    anchor.with("tileId", JsonPrimitive(owners.getValue(anchor.string("tileId")))),
                )
        if (row.string("id") in selectedTiles)
            result =
                result
                    .with("x", JsonPrimitive((row.number("x") + dx).toInt()))
                    .with("y", JsonPrimitive((row.number("y") + dy).toInt()))
                    .with("level", JsonPrimitive(row.number("level").toInt() - base + level))
        return result
    }
    var next =
        document
            .with("tiles", JsonArray(document.rows("tiles") + tiles.map(::copy)))
            .with("objects", JsonArray(document.rows("objects") + objects.map(::copy)))
    for (key in listOf("decals", "lights")) {
        val attached =
            original
                .rows(key)
                .filter {
                    (it["anchor"] as? JsonObject)?.string("id") in owners &&
                        (key != "lights" || it.string("builtinKey").isNotBlank())
                }
                .map { item ->
                    val anchor = item.getValue("anchor").jsonObject
                    item
                        .with("id", JsonPrimitive(UUID.randomUUID().toString()))
                        .with(
                            "anchor",
                            anchor.with("id", JsonPrimitive(owners.getValue(anchor.string("id")))),
                        )
                }
        if (attached.isNotEmpty()) next = next.with(key, JsonArray(next.rows(key) + attached))
    }
    // Standalone copied objects need a new free surface; attached ones follow the copied tiles.
    for (row in objects.filter { (it["placement"] as? JsonObject)?.string("tileId") !in owners }) {
        val id = owners.getValue(row.string("id"))
        next =
            moveMapObject(next, catalogue, id, MapPose(row.number("x") + dx, row.number("y") + dy))
    }
    return normalizeMapDocument(next, catalogue) to owners.values.toSet()
}
