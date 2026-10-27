package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.CatalogueItem
import ru.dndshare.client.model.text
import kotlin.math.floor

data class SheetResource(val title: String, val available: Int, val total: Int)
data class SheetAction(val title: String, val description: String)

private fun resourceMaximum(rule: JsonObject, owner: CatalogueItem, entry: JsonObject, sheet: CharacterSheet): Int? {
    val level = ownerLevel(owner.data, sheet)
    if (level < rule["level"].number(1)) return null
    if (rule["initial_charges"] == JsonPrimitive(true)) return entry["max_use"]?.number()
    val stat = rule["max_use_stat"].number()
    if (stat in 1..6) {
        val modifier = abilityModifier(sheet.statScore(listOf("STR", "DEX", "CON", "INT", "WIS", "CHA")[stat - 1]))
        val multiplier = rule["max_use_stat_multiplier"].number(1).takeUnless { it == 0 } ?: 1
        return maxOf(rule["max_use_min"].number(1), modifier * multiplier + rule["max_use_bonus"].number())
    }
    val multiplier = (rule["max_use_level_multiplier"] as? JsonPrimitive)?.doubleOrNull
    if (multiplier != null) return maxOf(rule["max_use_min"].number(), floor(level * multiplier + rule["max_use_bonus"].number()).toInt())
    if (rule["max_use_scaling"] == JsonPrimitive(true)) {
        owner.data["scaling"].arrayValue().map { it.objectValue() }.filter { it["uses"] != null && it["level"].number() <= level }
            .maxByOrNull { it["level"].number() }?.get("uses")?.let { return it.number() }
    }
    if (rule["manual_size"] == JsonPrimitive(true)) return (entry["max_use"] ?: rule["max_use"])?.number()
    return rule["max_use"]?.number()
}

fun sheetResources(sheet: CharacterSheet, items: Map<Long, CatalogueItem>): List<SheetResource> = buildList {
    sheet.values["resources"].arrayValue().forEach { raw ->
        val row = raw.objectValue(); val total = row["total"].number().coerceAtLeast(0)
        add(SheetResource(row.text("title").ifBlank { "Ресурс" }, row["value"].number().coerceIn(0, total), total))
    }
    for (feature in ownedFeatures(sheet, items)) {
        if (feature.item.typeId == 19L && !magicActive(feature.item, feature.instance, feature.equipped, sheet)) continue
        val definitions = feature.item.data["use_resources"].arrayValue()
        val rules = if (definitions.isEmpty()) listOf(feature.item.data) else definitions.map { it.objectValue() }
        for (rule in rules) {
            val total = resourceMaximum(rule, feature.item, feature.entry, sheet)?.coerceAtLeast(0) ?: continue
            val key = rule.text("key")
            val stored = if (definitions.isEmpty()) feature.entry["count"] else feature.entry["resource_counts"].objectValue()[key]
            add(SheetResource(rule.text("title").ifBlank { feature.item.name }, stored.number(total).coerceIn(0, total), total))
        }
    }
    val pools = linkedMapOf<String, Pair<String, Int>>()
    for (raw in sheet.values["classes"].arrayValue()) {
        val entry = raw.objectValue(); val item = items[entry["id"].referenceId()] ?: continue
        val level = entry["level"].number()
        for (value in item.data["class_resources"].arrayValue()) {
            val rule = value.objectValue(); val key = rule.text("key")
            if (key.isBlank() || level < rule["level"].number(1)) continue
            val scaling = rule["scaling"].arrayValue().map { it.objectValue() }.filter { it["level"].number() <= level && it["uses"] != null }.maxByOrNull { it["level"].number() }
            val total = (scaling?.get("uses") ?: rule["max_use"])?.number() ?: continue
            if (total > 0 && total > (pools[key]?.second ?: -1)) pools[key] = rule.text("title").ifBlank { item.name } to total
        }
    }
    for ((key, pool) in pools) add(SheetResource(pool.first, sheet.values["class_resource_counts"].objectValue()[key].number(pool.second).coerceIn(0, pool.second), pool.second))
}

fun sheetActions(sheet: CharacterSheet, items: Map<Long, CatalogueItem>): List<SheetAction> = buildList {
    sheet.values["actions"].arrayValue().forEach { raw -> val row = raw.objectValue(); add(SheetAction(row.text("title").ifBlank { "Своё действие" }, row.text("description"))) }
    val codes = sheet.values["states"].arrayValue().mapNotNull { items[it.objectValue()["effect_id"].referenceId()]?.data?.text("code") }.toSet()
    for (feature in ownedFeatures(sheet, items)) {
        if (feature.item.typeId == 19L && !magicActive(feature.item, feature.instance, feature.equipped, sheet)) continue
        for (raw in feature.item.data["feature_actions"].arrayValue()) {
            val action = raw.objectValue()
            if (ownerLevel(feature.item.data, sheet) < action["level"].number(1)) continue
            if (!action["required_status_codes"].arrayValue().all { it.jsonPrimitive.content in codes }) continue
            add(SheetAction(action.text("title").ifBlank { feature.item.name }, action.text("description")))
        }
    }
}

fun sheetDefenses(sheet: CharacterSheet, items: Map<Long, CatalogueItem>): List<JsonObject> = buildList {
    addAll(sheet.values["defenses"].arrayValue().map { it.objectValue() })
    for (feature in ownedFeatures(sheet, items)) {
        if (feature.item.typeId == 19L && !magicActive(feature.item, feature.instance, feature.equipped, sheet)) continue
        addAll(feature.item.data["defenses"].arrayValue().map { it.objectValue() }.filter { ownerLevel(feature.item.data, sheet) >= it["level"].number(1) })
    }
    sheet.values["states"].arrayValue().forEach { raw ->
        val state = raw.objectValue()
        if (state["external_only"] != JsonPrimitive(true)) addAll(items[state["effect_id"].referenceId()]?.data?.get("defenses").arrayValue().map { it.objectValue() })
    }
}
