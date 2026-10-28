package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

/** Same structured prerequisite checks as the web; prose prerequisites remain descriptive. */
fun featRequirements(
    item: CatalogueItem,
    scores: Map<String, Int>,
    level: Int,
    spellcasting: Boolean,
    armorProfIds: Set<Long>,
    category: String? = null,
): List<String> = buildList {
    val prereq = item.data["prereq"].objectValue()
    if (category != null && item.data.text("category") != category)
        add("Требуется черта выбранной категории.")
    val stats = listOf("STR", "DEX", "CON", "INT", "WIS", "CHA")
    val names = listOf("Сила", "Ловкость", "Телосложение", "Интеллект", "Мудрость", "Харизма")
    val minimums =
        prereq["min_stats"]
            .arrayValue()
            .map { it.objectValue() }
            .filter { it["ability"].referenceId() != null && it["value"] != null }
    if (minimums.isNotEmpty()) {
        val checks = minimums.map { row ->
            (scores[stats.getOrNull(row["ability"].number() - 1)] ?: 0) >= row["value"].number()
        }
        val any = prereq.text("min_stats_mode") == "any"
        if (!(if (any) checks.any { it } else checks.all { it }))
            add(
                minimums.joinToString(if (any) " или " else " и ") {
                    "${names.getOrNull(it["ability"].number() - 1) ?: "Характеристика"} ${it["value"].number()}"
                }
            )
    }
    if (prereq["spellcasting"] == JsonPrimitive(true) && !spellcasting)
        add("Способность накладывать заклинания")
    val categoryLevel =
        when (item.data.text("category")) {
            "general" -> 4
            "epic_boon" -> 19
            else -> 0
        }
    val minimumLevel = maxOf(categoryLevel, prereq["min_level"].number())
    if (level < minimumLevel) add("$minimumLevel уровень")
    val requiredArmor = prereq["armor_prof"].arrayValue().mapNotNull { it.referenceId() }
    if (!armorProfIds.containsAll(requiredArmor)) add("Требуемое владение доспехами")
}

/**
 * The shared static grant contract, before labels are resolved against the character's
 * dictionaries.
 */
fun featGrants(item: CatalogueItem, choices: JsonObject): JsonObject {
    val grants =
        item.data["grants"]
            .objectValue()
            .mapValues { JsonArray(it.value.arrayValue()) }
            .toMutableMap()
    for (choice in ru.dndshare.client.character.creation.itemChoices(item)) {
        val key = choice.text("grant_proficiency")
        if (key.isBlank()) continue
        grants[key] =
            JsonArray(
                (grants[key].arrayValue() + choices[choice.text("key")].arrayValue()).distinctBy {
                    it.referenceId()?.toString() ?: it.toString()
                }
            )
    }
    return JsonObject(grants)
}
