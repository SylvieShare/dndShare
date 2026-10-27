package ru.dndshare.client.character

import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.model.CatalogueItem
import ru.dndshare.client.model.text

private fun manualStatus(effect: CatalogueItem, source: JsonObject = buildJsonObject { put("kind", "manual") }): JsonObject = buildJsonObject {
    put("uid", UUID.randomUUID().toString()); put("effect_id", effect.id); put("source", source)
    put("params", buildJsonObject { if (effect.data["level"].number() > 0) put("level", effect.data["level"].number()) })
    put("duration", effect.data["duration"] ?: JsonNull)
    put("concentration", effect.data["concentration"] == JsonPrimitive(true))
}

fun selectedStatusPatches(sheet: CharacterSheet, selected: List<Long>, items: Map<Long, CatalogueItem>): List<SheetPatch> {
    val previous = sheet.values["states"].arrayValue().map { it.objectValue() }
    var result = previous.filter { it["effect_id"].referenceId() in selected }
    for (id in selected) {
        if (result.any { it["effect_id"].referenceId() == id }) continue
        val effect = items[id] ?: error("Выбранное состояние пока недоступно. Дождитесь загрузки справочника.")
        val created = manualStatus(effect)
        val blocks = effect.data["derived_effects"].arrayValue().any { rule ->
            rule.objectValue().text("kind") == "activity_block" && rule.objectValue()["scopes"].arrayValue().contains(JsonPrimitive("concentration"))
        }
        if (created["concentration"] == JsonPrimitive(true) || blocks) result = result.filterNot { it["concentration"] == JsonPrimitive(true) }
        result = result + created
    }
    for (removed in previous.filter { before -> result.none { it["uid"] == before["uid"] } }) {
        val source = items[removed["effect_id"].referenceId()] ?: continue
        val end = items[source.data["on_end_effect"].referenceId()] ?: continue
        if (result.none { it["effect_id"].referenceId() == end.id }) result = result + manualStatus(end,
            buildJsonObject { put("kind", "effect"); put("item_id", source.id); put("label", source.name) })
    }
    if (result == previous) return emptyList()
    if (sheet.values["states"] !is JsonArray || (previous + result).any { it.text("uid").isBlank() }) {
        return listOf(SheetPatch(path = sheetPath("values", "states"), value = JsonArray(result)))
    }
    fun path(row: JsonObject) = sheetPath("values", "states") + buildJsonObject { put("idField", "uid"); put("id", row.getValue("uid")) }
    return previous.filter { old -> result.none { it["uid"] == old["uid"] } }.map { SheetPatch("remove", path(it)) } +
        result.filter { row -> previous.none { it["uid"] == row["uid"] } }.map { SheetPatch("insert", path(it), it) }
}
