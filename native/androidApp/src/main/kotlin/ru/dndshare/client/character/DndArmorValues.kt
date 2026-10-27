package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

data class ArmorReadout(val total: Int, val body: CatalogueItem?, val shield: CatalogueItem?, val speedPenalty: Int)
private data class ArmorCandidate(val item: CatalogueItem, val value: Int, val shield: Boolean)

fun armorReadout(derived: DndDerivedValues): ArmorReadout {
    val sheet = derived.sheet
    val dexterity = abilityModifier(derived.score("DEX"))
    val candidates = inventoryInstances(sheet).filter { it.second }.mapNotNull { (entry, _) ->
        val original = derived.items[(entry["magic_item_id"] ?: entry["item_id"]).referenceId()] ?: return@mapNotNull null
        val item = resolveArmor(original, entry, derived) ?: return@mapNotNull null
        val rule = item.data["armor"] as? JsonObject ?: return@mapNotNull null
        if (item.typeId !in listOf(12L, 19L)) return@mapNotNull null
        val shield = rule["shield"] == JsonPrimitive(true) || item.data.text("category") == "shield"
        val dex = if (shield || rule["use_dex"] == JsonPrimitive(false)) 0 else
            rule["dex_cap"]?.let { minOf(dexterity, it.number()) } ?: dexterity
        val bonus = entry["params"].objectValue()["magic_bonus"].number()
        val value = if (shield && sheet.sourceVersion == "2024" && !armorProficient(item, derived)) 0
            else if (shield) rule["shield_bonus"].number(2) + bonus else rule["ac"].number(10) + dex + bonus
        ArmorCandidate(item, value, shield)
    }
    val body = candidates.filterNot { it.shield }.maxByOrNull { it.value }
    val shield = candidates.filter { it.shield }.maxByOrNull { it.value }
    val formula = derived.rules("armor_formula", RuleContext(deferEquipment = true)).mapNotNull { source ->
        val rule = source.rule
        if (body != null || shield != null && rule["allow_shield"] == JsonPrimitive(false)) null else
            rule["base"].number(10) + rule["ability_ids"].arrayValue().sumOf { raw ->
                val index = raw.number() - 1
                if (index in 0..5) abilityModifier(derived.score(listOf("STR", "DEX", "CON", "INT", "WIS", "CHA")[index])) else 0
            }
    }.maxOrNull()
    val equipment = RuleContext(armor = body != null, shield = shield != null, heavyArmor = body?.item?.data?.text("category") == "heavy")
    val manual = sheet.values["armor"].objectValue()["bonuses"].arrayValue().filterNot {
        val row = it.objectValue()
        row["readonly"] == JsonPrimitive(true) && row.text("name").ifBlank { row.text("title") }.lowercase().startsWith("экипировано:")
    }.sumOf { it.objectValue()["value"].number() }
    val bonus = derived.rules("armor_bonus", equipment).sumOf { it.rule["value"].number() }
    val minimum = derived.rules("armor_minimum", equipment).maxOfOrNull { it.rule["value"].number() } ?: 0
    val total = maxOf(minimum, (body?.value ?: formula ?: (10 + dexterity)) + (shield?.value ?: 0) + manual + bonus)
    val ancestry = (sheet.values["race"].objectValue().label() + " " + sheet.values["subrace"].objectValue().label()).lowercase()
    val ignoreStrength = sheet.sourceVersion != "2024" && ("дварф" in ancestry || "dwarf" in ancestry)
    val penalty = if (!ignoreStrength && body != null && body.item.data["strength_required"].number() > derived.score("STR")) 10 else 0
    return ArmorReadout(total, body?.item, shield?.item, penalty)
}

private fun armorProficient(item: CatalogueItem, derived: DndDerivedValues): Boolean {
    val required = item.data["required_armor_proficiency"]?.takeUnless { it == JsonNull } ?: return true
    val requiredId = required.jsonPrimitive.content
    val granted = derived.effects.filter { it.rule.text("kind") == "armor_proficiency" }.flatMap { source ->
        val rule = source.rule
        if (rule["target_from_choice"] == JsonPrimitive(true)) {
            val prefix = rule.text("choice_value_prefix").takeIf(String::isNotBlank)?.plus(":").orEmpty()
            source.entry["choices"].objectValue()[rule.text("choice_key")].arrayValue().map { it.jsonPrimitive.content }
                .filter { prefix.isBlank() || it.startsWith(prefix) }.map { it.removePrefix(prefix) }
        } else rule["target_ids"].arrayValue().map { it.jsonPrimitive.content }
    }
    if (requiredId in granted) return true
    val owned = derived.sheet.values["proficiencies"].objectValue()["Доспехи"].arrayValue().map {
        (if (it is JsonObject) it.label() else it.jsonPrimitive.content).trim().lowercase()
    }
    return derived.metadata.suggests["3"].orEmpty().any { it.id.toString() == requiredId && it.value.trim().lowercase() in owned }
}

private fun resolveArmor(item: CatalogueItem, entry: JsonObject, derived: DndDerivedValues): CatalogueItem? {
    if (item.typeId != 19L) return item
    val rule = item.data["armor_base"] as? JsonObject ?: return null
    val baseId = (rule["base_item_id"] ?: entry["params"].objectValue()["armor_base_item_id"]).referenceId()
    val base = derived.items[baseId] ?: return null
    if (base.typeId != 12L || base.data["armor"] !is JsonObject) return null
    val params = entry["params"].objectValue()
    if (params["magic"].objectValue()["lost"] == JsonPrimitive(true)) return base
    val activeItem = if (rule["bonus_without_attunement"] == JsonPrimitive(true)) item.copy(data = JsonObject(item.data + ("attunement" to JsonPrimitive("none")))) else item
    val armor = base.data["armor"].objectValue().toMutableMap()
    val key = if (armor["shield"] == JsonPrimitive(true)) "shield_bonus" else "ac"
    armor[key] = JsonPrimitive(armor[key].number(if (key == "ac") 10 else 2) +
        if (magicActive(activeItem, entry, true, derived.sheet)) rule["magic_bonus"].number() else 0)
    val data = item.data.toMutableMap()
    data["armor"] = JsonObject(armor)
    data["category"] = base.data["category"] ?: JsonNull
    data["strength_required"] = if (rule["ignore_strength"] == JsonPrimitive(true)) JsonPrimitive(0) else base.data["strength_required"] ?: JsonPrimitive(0)
    data["required_armor_proficiency"] = if (rule["grants_proficiency"] == JsonPrimitive(true)) JsonNull else base.data["required_armor_proficiency"] ?: JsonNull
    return item.copy(data = JsonObject(data))
}
