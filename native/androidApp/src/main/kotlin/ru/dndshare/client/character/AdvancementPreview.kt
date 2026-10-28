package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

/**
 * Incomplete choice forms may be projected for eligibility, but never committed without validation.
 */
fun abilitySelectionDraft(
    sheet: CharacterSheet,
    parentId: Long,
    entries: List<JsonElement>,
    items: Map<Long, CatalogueItem>,
): CharacterSheet {
    val previous = selectedAbilityEntries(sheet, parentId, items)
    val unrelated = sheet.values["abilities_class"].arrayValue() - previous.toSet()
    val selected = entries.mapNotNull { raw ->
        val id = raw.referenceId() ?: return@mapNotNull null
        val old = previous.firstOrNull { it.referenceId() == id }.objectValue()
        JsonObject(
            old +
                raw.objectValue() +
                mapOf("id" to JsonPrimitive(id), "selection_source" to JsonPrimitive(parentId))
        )
    }
    return sheet.copy(
        data =
            applySheetPatches(
                sheet.data,
                listOf(
                    SheetPatch(
                        path = sheetPath("values", "abilities_class"),
                        value = JsonArray(unrelated + selected),
                    )
                ),
            )
    )
}

fun advancementPreview(plan: LevelAdvancement): CharacterSheet {
    if (plan.input["advance"] != JsonPrimitive(true)) return plan.sheet
    val values = plan.sheet.values.toMutableMap()
    values["lvl"] =
        JsonObject(values["lvl"].objectValue() + ("level" to JsonPrimitive(plan.total + 1)))
    values["classes"] = JsonArray(plan.classesAfter())
    val old = values["abilities_class"].arrayValue()
    values["abilities_class"] =
        JsonArray(
            old +
                plan.newFeatures
                    .filter { feature -> old.none { it.referenceId() == feature.id } }
                    .map { feature ->
                        buildJsonObject {
                            put("id", feature.id)
                            put("choices", plan.choices(feature))
                        }
                    }
        )
    if (plan.hasAsi && plan.input.text("asiMode") == "feat")
        plan.feat?.let { feat ->
            values["abilities_feats"] =
                JsonArray(
                    values["abilities_feats"].arrayValue() +
                        buildJsonObject {
                            put("id", feat.id)
                            put("uid", "preview-feat:" + feat.id)
                            put("choices", plan.choices(feat))
                        }
                )
        }
    var projected =
        plan.sheet.copy(data = JsonObject(plan.sheet.data + ("values" to JsonObject(values))))
    val parents =
        (ownedFeatures(plan.sheet, plan.items).map { it.item } + plan.newFeatures)
            .distinctBy { it.id }
            .filter { it.data["ability_selection"] is JsonObject }
    for (parent in parents) projected =
        abilitySelectionDraft(
            projected,
            parent.id,
            plan.selected(parent).map { feature ->
                buildJsonObject {
                    put("id", feature.id)
                    put("choices", plan.choices(feature))
                }
            },
            plan.items,
        )
    val spells = projected.values["spells"].objectValue()
    val rows = spells["tabs"].arrayValue()
    val selection = AdvancementSpellSelection(plan)
    if (selection.rules != null) {
        val current =
            rows
                .map { it.objectValue() }
                .firstOrNull { it["class_item_id"].referenceId() == plan.classId }
        val existing = current?.get("spells").arrayValue()
        val entries =
            selection.selected.map { id ->
                existing.firstOrNull { it.referenceId() == id }
                    ?: buildJsonObject {
                        put("id", id)
                        put("key", "preview:$id")
                    }
            }
        val tab =
            JsonObject(
                (current ?: JsonObject(emptyMap())) +
                    mapOf(
                        "class_item_id" to JsonPrimitive(plan.classId),
                        "spells" to JsonArray(entries),
                    )
            )
        val updated =
            rows.filterNot { it.objectValue()["class_item_id"].referenceId() == plan.classId } + tab
        projected =
            projected.copy(
                data =
                    applySheetPatches(
                        projected.data,
                        listOf(
                            sheetFieldPatch(
                                projected,
                                sheetPath("values", "spells"),
                                JsonObject(spells + ("tabs" to JsonArray(updated))),
                            )
                        ),
                    )
            )
    }
    return projected.copy(
        data = applySheetPatches(projected.data, abilitySpellGrantPatches(projected, plan.items))
    )
}
