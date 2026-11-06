package ru.dndshare.client.character

import kotlinx.serialization.json.*

/** Display-only grants follow the same conditions as the attack, armor and tool calculators. */
fun DndDerivedValues.proficiencyGroups(): Map<String, List<String>> {
    val groups = sheet.values["proficiencies"].objectValue().mapValues { (_, rows) ->
        rows.arrayValue().map {
            if (it is JsonObject) it.label() else (it as? JsonPrimitive)?.content.orEmpty()
        }
    }.toMutableMap()
    for ((title, dictionary, kind) in listOf(
        Triple("Оружие", "4", "weapon_proficiency"),
        Triple("Доспехи", "3", "armor_proficiency"),
        Triple("Инструменты", "5", "tool_proficiency"),
        Triple("Языки", "6", "language_proficiency"),
    )) {
        val labels = metadata.suggests[dictionary].orEmpty().associate { it.id.toString() to it.value }
        groups[title] = (groups[title].orEmpty() + grantedTargets(kind).mapNotNull(labels::get)).distinct()
    }
    return groups.filterValues { it.isNotEmpty() }
}
