package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.CatalogueItem
import ru.dndshare.client.model.text

data class OwnedFeature(val item: CatalogueItem, val entry: JsonObject, val key: String, val equipped: Boolean = true, val instance: JsonObject = entry)
data class OwnedDerivedRule(val rule: JsonObject, val entry: JsonObject, val status: Boolean = false)

fun JsonElement?.referenceId(): Long? = when (this) {
    is JsonPrimitive -> longOrNull
    is JsonObject -> this["id"]?.jsonPrimitive?.longOrNull
    else -> null
}

fun ownerLevel(data: JsonObject, sheet: CharacterSheet): Int {
    val level = sheet.values["lvl"].objectValue()["level"].number()
    val mode = data.text("level_source").ifBlank { "bound" }
    if (mode == "character") return level
    val classes = if (mode == "class") listOfNotNull(data["level_class_id"].referenceId()) else data["class_ids"].arrayValue().mapNotNull { it.referenceId() }
    val subclasses = if (mode == "class") classes else data["subclass_ids"].arrayValue().mapNotNull { it.referenceId() }
    if (mode == "bound" && classes.isEmpty() && subclasses.isEmpty()) return level
    val all = sheet.values["classes"].arrayValue().map { it.objectValue() }
    val matching = all.filter { it["id"].referenceId() in classes || it["subclass"].referenceId() in subclasses }
    return if (matching.isEmpty()) 0 else if (all.size == 1 && level > 0) level else matching.maxOf { it["level"].number() }
}

fun inventoryInstances(sheet: CharacterSheet): List<Pair<JsonObject, Boolean>> {
    val inventory = sheet.values["items"].objectValue()
    return (sheet.values["weapon"].arrayValue() + inventory["equipped"].arrayValue()).map { it.objectValue() to true } +
        inventory["sections"].arrayValue().flatMap { it.objectValue()["items"].arrayValue() }.map { it.objectValue() to false }
}

fun magicActive(item: CatalogueItem, entry: JsonObject, equipped: Boolean, sheet: CharacterSheet, activation: String = ""): Boolean {
    val params = entry["params"].objectValue()
    val magic = params["magic"].objectValue()
    if (magic["lost"] == JsonPrimitive(true) || params["creation"].objectValue()["expired"] == JsonPrimitive(true)) return false
    if (entry["count"].number(1) <= 0 || ownerLevel(item.data, sheet) < item.data["level"].number(1).coerceAtLeast(1)) return false
    if ((activation.ifBlank { item.data.text("activation") }) != "carried" && !equipped) return false
    return item.data.text("attunement") == "none" || magic["attuned"] == JsonPrimitive(true)
}

fun ownedFeatures(sheet: CharacterSheet, items: Map<Long, CatalogueItem>): List<OwnedFeature> = buildList {
    for (key in listOf("abilities_class", "abilities_race", "abilities_story", "abilities_feats")) {
        for (raw in sheet.values[key].arrayValue()) {
            val entry = raw.objectValue()
            if (key == "abilities_feats" && entry["requirements_met"] == JsonPrimitive(false)) continue
            items[entry["id"].referenceId()]?.let { add(OwnedFeature(it, entry, key)) }
        }
    }
    for ((entry, equipped) in inventoryInstances(sheet)) {
        val item = items[(entry["magic_item_id"] ?: entry["item_id"]).referenceId()] ?: continue
        if (item.typeId == 19L && entry.text("uid").isNotBlank()) {
            val state = entry["params"].objectValue()["magic"].objectValue()
            val normalized = JsonObject(state + mapOf("id" to JsonPrimitive(item.id), "uid" to entry.getValue("uid"), "count" to (state["remaining"] ?: JsonNull)))
            add(OwnedFeature(item, normalized, "magic_items", equipped, entry))
        }
    }
}

fun collectDerivedRules(sheet: CharacterSheet, items: Map<Long, CatalogueItem>): List<OwnedDerivedRule> = buildList {
    for (feature in ownedFeatures(sheet, items)) {
        for (raw in feature.item.data["derived_effects"].arrayValue()) {
            val rule = raw.objectValue()
            if (feature.item.typeId == 19L && !magicActive(feature.item, feature.instance, feature.equipped, sheet, rule.text("activation"))) continue
            if (rule.text("kind").isBlank() || ownerLevel(feature.item.data, sheet) < rule["level"].number(1).coerceAtLeast(1)) continue
            add(OwnedDerivedRule(rule, feature.entry))
        }
    }
    for (raw in sheet.values["states"].arrayValue()) {
        val state = raw.objectValue()
        if (state["external_only"] == JsonPrimitive(true)) continue
        val item = items[state["effect_id"].referenceId()] ?: continue
        val params = state["params"].objectValue()
        if (item.data["ongoing_damage"] != null && params.text("damage_phase") !in listOf("turn_damage", "turn_save")) continue
        for (value in item.data["derived_effects"].arrayValue()) {
            val rule = value.objectValue().toMutableMap()
            val parameter = rule["value_parameter"]?.jsonPrimitive?.content.orEmpty()
            val target = rule["target_parameter"]?.jsonPrimitive?.content.orEmpty()
            if (target.isNotBlank() && params[target] == null) continue
            if (parameter.isNotBlank()) rule["value"] = params[parameter] ?: JsonPrimitive(0)
            if (target.isNotBlank()) rule["target_ids"] = JsonArray(listOfNotNull(params[target]))
            add(OwnedDerivedRule(JsonObject(rule), JsonObject(emptyMap()), status = true))
        }
    }
}

fun featureHpBonus(sheet: CharacterSheet, items: Map<Long, CatalogueItem>): Int = ownedFeatures(sheet, items).sumOf { feature ->
    if (feature.item.typeId == 19L && !magicActive(feature.item, feature.instance, feature.equipped, sheet)) return@sumOf 0
    val level = ownerLevel(feature.item.data, sheet)
    feature.item.data["hp_bonuses"].arrayValue().sumOf { raw ->
        val rule = raw.objectValue()
        if (level < rule["level"].number(1).coerceAtLeast(1)) 0 else rule["base"].number() + level * rule["per_level"].number()
    }
}
