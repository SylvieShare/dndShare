package ru.dndshare.client.ui.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.character.creation.*
import ru.dndshare.client.model.*

internal fun prepareAbilityEntry(
    row: MutableMap<String, JsonElement>,
    old: JsonObject,
    sheet: CharacterSheet,
    item: CatalogueItem,
    metadata: HandbookMetadata,
    items: Map<Long, CatalogueItem>,
) {
    val choices = row["choices"].objectValue()
    validateCharacterChoices(item, choices, sheet, items, metadata, old)
    val asi = item.data["asi_choice"].objectValue()
    if (asi.isNotEmpty())
        require(
            choices[asi.text("choice_key").ifBlank { "ability" }].arrayValue().size ==
                asi["count"].number(1)
        ) {
            "Выберите прибавку характеристики."
        }
    if (old.isEmpty()) {
        if (item.data["use_resources"].arrayValue().isNotEmpty())
            row["resource_version"] = JsonPrimitive(1)
        if (item.data["repeatable"] == JsonPrimitive(true))
            row["uid"] = JsonPrimitive(java.util.UUID.randomUUID().toString())
        val total = resourceMaximum(item.data, item, JsonObject(row), sheet)
        if (total != null) {
            if (row["count"] == null || row["count"] == JsonNull)
                row["count"] = JsonPrimitive(total)
            row["resource_version"] = JsonPrimitive(1)
            if (item.data["manual_size"] == JsonPrimitive(true))
                row["max_use"] = JsonPrimitive(total)
        }
    }
    if (item.typeId == 7L) {
        val removed = featStatBonusPatches(sheet, old, null, null)
        val withoutOwnBonus = sheet.copy(data = applySheetPatches(sheet.data, removed))
        val failures = sheetFeatRequirements(withoutOwnBonus, item, items, metadata)
        row["requirements_met"] = JsonPrimitive(failures.isEmpty())
    }
}

internal fun abilityEntrySideEffects(
    sheet: CharacterSheet,
    bucket: String,
    before: JsonObject,
    after: JsonObject?,
    items: Map<Long, CatalogueItem>,
): List<SheetPatch> {
    val removed =
        mutableSetOf<Long>().apply {
            if (
                before.isNotEmpty() &&
                    (after == null || before.referenceId() != after.referenceId())
            )
                before.referenceId()?.let(::add)
        }
    val patches = mutableListOf<SheetPatch>()
    val parentId = before.referenceId()
    val otherOwner =
        parentId != null && sheet.values[bucket].arrayValue().any { it.referenceId() == parentId }
    val children =
        sheet.values["abilities_class"].arrayValue().filter {
            !otherOwner && it.objectValue()["selection_source"].referenceId() in removed
        }
    if (children.isNotEmpty()) {
        patches.add(
            SheetPatch(
                path = sheetPath("values", "abilities_class"),
                value = JsonArray(sheet.values["abilities_class"].arrayValue() - children.toSet()),
            )
        )
        children.mapNotNullTo(removed) { it.referenceId() }
    }
    if (removed.isNotEmpty())
        patches.add(
            SheetPatch(
                path = sheetPath("values", "states"),
                value =
                    JsonArray(
                        sheet.values["states"].arrayValue().filterNot {
                            val source = it.objectValue()["source"].objectValue()
                            val id = source["item_id"].referenceId()
                            if (
                                source.text("kind") !in setOf("ability", "feature_action") ||
                                    id !in removed
                            )
                                false
                            else if (id != parentId) true
                            else if (
                                source.text("value_id").isNotBlank() &&
                                    source.text("value_id") != bucket
                            )
                                false
                            else if (source.text("entry_key").isNotBlank())
                                source.text("entry_key") ==
                                    before.text("uid").ifBlank { before.text("id") }
                            else !otherOwner
                        }
                    ),
            )
        )
    if (bucket != "abilities_feats") return patches
    return patches +
        featStatBonusPatches(sheet, before, after, after?.referenceId()?.let(items::get))
}
