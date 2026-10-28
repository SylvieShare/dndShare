package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.creation.creationStats
import ru.dndshare.client.model.*

fun sheetFeatRequirements(
    sheet: CharacterSheet,
    item: CatalogueItem,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
): List<String> {
    val labels =
        sheet.values["proficiencies"]
            .objectValue()["Доспехи"]
            .arrayValue()
            .mapNotNull { (it as? JsonPrimitive)?.content?.lowercase() }
            .toSet()
    val armor =
        metadata.suggests["3"]
            .orEmpty()
            .filter { it.value.lowercase() in labels }
            .map { it.id }
            .toMutableSet()
    for (raw in sheet.values["abilities_feats"].arrayValue()) {
        val entry = raw.objectValue()
        if (entry["requirements_met"] == JsonPrimitive(false)) continue
        for (effect in items[entry.referenceId()]?.data?.get("derived_effects").arrayValue()) {
            val rule = effect.objectValue()
            if (rule.text("kind") == "armor_proficiency")
                rule["target_ids"].arrayValue().mapNotNullTo(armor) { it.referenceId() }
        }
    }
    return featRequirements(
        item,
        creationStats.associateWith(sheet::statScore),
        sheet.values["lvl"].objectValue()["level"].number(1),
        sheet.values["spells"] is JsonObject,
        armor,
    )
}

/** A remote edit and a native form use the same reconciliation, without changing owned counters. */
fun featRequirementPatches(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
): List<SheetPatch> {
    if (sheet.templateName != "DND5") return emptyList()
    if (sheet.values["abilities_feats"].arrayValue().any { it.referenceId() !in items })
        return emptyList()
    var current = sheet
    val patches = mutableListOf<SheetPatch>()
    // Positive feat dependencies can cascade; converge before emitting one durable edit.
    repeat(sheet.values["abilities_feats"].arrayValue().size + 1) {
        val rows = current.values["abilities_feats"].arrayValue().toMutableList()
        var changed = false
        for ((index, raw) in rows.withIndex()) {
            val entry = raw.objectValue()
            val item = items[entry.referenceId()] ?: continue
            // The handbook may still be hydrating. Absence is not a failed prerequisite.
            if (
                item.data["prereq"].objectValue()["armor_prof"].arrayValue().isNotEmpty() &&
                    metadata.suggests["3"].isNullOrEmpty()
            )
                continue
            val met = sheetFeatRequirements(current, item, items, metadata).isEmpty()
            if (met == (entry["requirements_met"] != JsonPrimitive(false))) continue
            val next =
                if (met) JsonObject(entry - "requirements_met")
                else JsonObject(entry + ("requirements_met" to JsonPrimitive(false)))
            val bonuses = featStatBonusPatches(current, entry, next, item)
            current = current.copy(data = applySheetPatches(current.data, bonuses))
            patches.addAll(bonuses)
            rows[index] = next
            changed = true
        }
        if (!changed) return patches.asReversed().distinctBy { it.path }.asReversed()
        val patch =
            SheetPatch(path = sheetPath("values", "abilities_feats"), value = JsonArray(rows))
        current = current.copy(data = applySheetPatches(current.data, listOf(patch)))
        patches.add(patch)
    }
    return patches.asReversed().distinctBy { it.path }.asReversed()
}
