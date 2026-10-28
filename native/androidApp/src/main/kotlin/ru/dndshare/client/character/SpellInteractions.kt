package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

fun spellPreparationPatch(
    sheet: CharacterSheet,
    key: String,
    prepared: Boolean,
    items: Map<Long, CatalogueItem>,
): SheetPatch {
    val tab =
        sheet.values["spells"]
            .objectValue()["tabs"]
            .arrayValue()
            .map { it.objectValue() }
            .firstOrNull { tab ->
                tab["spells"].arrayValue().any { it.objectValue().text("key") == key }
            } ?: error("Заклинания больше нет в книге.")
    val entry = tab["spells"].arrayValue().map { it.objectValue() }.single { it.text("key") == key }
    require(
        tab.text("mode") in setOf("prepared", "spellbook") &&
            items[entry.referenceId()]?.data?.get("lvl").number() > 0
    ) {
        "Это заклинание не требует подготовки."
    }
    if (prepared && entry["prepared"] != JsonPrimitive(true))
        spellBookRules(sheet, tab, items)?.preparedLimit?.let { limit ->
            require(preparedSpellCount(tab["spells"].arrayValue(), items) < limit) {
                "Лимит подготовки: сначала снимите подготовку другого заклинания."
            }
        }
    return SheetPatch(
        path =
            sheetPath("values", "spells", "tabs") +
                sheetSelector("key", tab.getValue("key")) +
                sheetPath("spells") +
                sheetSelector("key", entry.getValue("key")) +
                sheetPath("prepared"),
        value = JsonPrimitive(prepared),
    )
}

fun spellSlotUsedPatch(sheet: CharacterSheet, pool: String, level: Int, used: Int): SheetPatch {
    require(pool in setOf("long_rest", "short_rest"))
    val rows =
        sheet.values["spells"].objectValue()["slot_pools"].objectValue()[pool].arrayValue().map {
            it.objectValue()
        }
    val row =
        rows.singleOrNull { it["level"].number() == level } ?: error("Ячейка больше не существует.")
    require(level in 1..9 && used in 0..row["total"].number()) {
        "Недопустимое число потраченных ячеек."
    }
    return SheetPatch(
        path =
            sheetPath("values", "spells", "slot_pools", pool) +
                sheetSelector("level", row.getValue("level")) +
                sheetPath("used"),
        value = JsonPrimitive(used),
    )
}

/** A damage/save event belongs to the currently concentrated cast, never another spell's cast. */
fun spellConcentrationData(
    request: SheetRollRequest,
    event: JsonObject,
    held: JsonObject?,
): JsonObject {
    if (
        held == null ||
            request.spellKey.isBlank() ||
            request.kind in setOf("attack", "heal") ||
            held["spellId"].referenceId() != request.sourceItemId ||
            held.text("id").isBlank()
    )
        return event
    return JsonObject(event + ("castId" to held.getValue("id")))
}
