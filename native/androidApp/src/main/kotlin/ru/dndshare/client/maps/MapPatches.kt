package ru.dndshare.client.maps

import kotlinx.serialization.json.*
import ru.dndshare.client.character.SheetPatch
import ru.dndshare.client.character.applySheetPatches

/** Entity IDs keep a single movement small even on a map with thousands of tiles. */
fun mapDiff(before: JsonObject, after: JsonObject): List<MapPatch> =
    mapValueDiff(before, after, emptyList())

private fun mapValueDiff(
    before: JsonElement?,
    after: JsonElement?,
    path: List<JsonElement>,
): List<MapPatch> =
    when {
        before == after -> emptyList()
        after == null -> listOf(MapPatch("remove", path))
        before is JsonObject && after is JsonObject ->
            (before.keys + after.keys).flatMap { key ->
                mapValueDiff(before[key], after[key], path + JsonPrimitive(key))
            }
        before is JsonArray && after is JsonArray && stableIds(before) && stableIds(after) ->
            mapArrayDiff(before, after, path)
        else -> listOf(MapPatch(path = path, value = after))
    }

private fun stableIds(rows: JsonArray): Boolean {
    val ids = rows.mapNotNull { (it as? JsonObject)?.get("id") as? JsonPrimitive }
    return ids.size == rows.size &&
        ids.none { it == JsonNull || it.content.isBlank() } &&
        ids.toSet().size == ids.size
}

private fun mapArrayDiff(
    before: JsonArray,
    after: JsonArray,
    path: List<JsonElement>,
): List<MapPatch> {
    val old = before.associateBy { it.jsonObject.getValue("id") }
    val next = after.associateBy { it.jsonObject.getValue("id") }
    fun selector(id: JsonElement) = buildJsonObject {
        put("idField", "id")
        put("id", id)
    }
    return buildList {
        for ((id, _) in old) if (id !in next) add(MapPatch("remove", path + selector(id)))
        for ((id, row) in next) {
            if (id in old) addAll(mapValueDiff(old[id], row, path + selector(id)))
            else add(MapPatch("insert", path + selector(id), row))
        }
        val resultingOrder = old.keys.filter { it in next } + next.keys.filter { it !in old }
        if (resultingOrder != next.keys.toList())
            add(MapPatch("order", path, JsonArray(next.keys.toList()), idField = "id"))
    }
}

fun mapApply(document: JsonObject, patches: List<MapPatch>): JsonObject =
    applySheetPatches(
        document,
        patches.map { SheetPatch(it.op, it.path, it.value, it.idField, it.beforeId) },
    )

fun mapHistory(before: JsonObject, after: JsonObject) =
    MapHistoryStep(mapDiff(before, after), mapDiff(after, before))
