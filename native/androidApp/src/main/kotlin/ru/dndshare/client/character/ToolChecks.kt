package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.creation.creationStats
import ru.dndshare.client.model.*

fun toolProficiencyRank(
    sheet: CharacterSheet,
    item: CatalogueItem,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
): Int {
    val ids = item.data["required_tool_proficiencies"].arrayValue().mapNotNull { it.referenceId() }
    val labels =
        sheet.values["proficiencies"]
            .objectValue()["Инструменты"]
            .arrayValue()
            .map { raw ->
                if (raw is JsonObject)
                    raw.text("name").ifBlank { raw.text("value").ifBlank { raw.text("title") } }
                else (raw as? JsonPrimitive)?.content.orEmpty()
            }
            .map { it.trim().lowercase() }
            .toSet()
    val manual =
        metadata.suggests["5"].orEmpty().any {
            it.id in ids && it.value.trim().lowercase() in labels
        }
    val derived = DndDerivedValues(sheet, items, metadata)
    return maxOf(
        if (manual) 1 else 0,
        ids.maxOfOrNull {
            derived.rank("tool_proficiency", RuleContext(kind = "tool", target = JsonPrimitive(it)))
        } ?: 0,
    )
}

fun toolRollRequest(
    sheet: CharacterSheet,
    uid: String,
    ability: Long,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
): SheetRollRequest {
    require(ability in 1..6)
    val entry =
        inventoryEntry(sheet.values["items"].objectValue(), uid)
            ?: error("Инструмент больше недоступен.")
    val item = resolveInventoryItem(entry, items) ?: error("Дождитесь загрузки инструмента.")
    require(item.typeId == 14L) { "Этот предмет не является инструментом." }
    val rank = toolProficiencyRank(sheet, item, items, metadata)
    val derived = DndDerivedValues(sheet, items, metadata)
    val stat = creationStats[ability.toInt() - 1]
    val context = RuleContext(kind = "tool", ability = ability, proficient = rank > 0)
    val bonus =
        abilityModifier(derived.score(stat)) +
            rank * sheet.proficiency() +
            derived.bonus("check_bonus", context)
    val name = entry["override"].objectValue().text("name").ifBlank { item.name }
    return SheetRollRequest(
        "$name — ${statTitlesForTools[ability.toInt()-1]}",
        ability = ability,
        bonus = bonus,
        targetUid = uid,
        sourceItemId = item.id,
        sourceName = name,
        proficiencyRank = rank,
        eventData =
            buildJsonObject {
                put("toolUid", uid)
                put("abilitySuggestId", ability)
            },
    )
}

private val statTitlesForTools =
    listOf("Сила", "Ловкость", "Телосложение", "Интеллект", "Мудрость", "Харизма")
