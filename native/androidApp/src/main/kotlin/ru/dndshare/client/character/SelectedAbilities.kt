package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.creation.itemChoices
import ru.dndshare.client.model.*

fun abilitySelectionCount(parent: CatalogueItem, sheet: CharacterSheet): Int {
    val level = ownerLevel(parent.data, sheet)
    if (level < parent.data["level"].number(1)) return 0
    return parent.data["ability_selection"]
        .objectValue()["counts"]
        .arrayValue()
        .map { it.objectValue() }
        .filter { it["level"].number() <= level }
        .maxByOrNull { it["level"].number() }
        ?.get("count")
        .number()
        .coerceAtLeast(0)
}

fun abilityReplacementCount(parent: CatalogueItem, sheet: CharacterSheet): Int {
    val rules = parent.data["ability_selection"].objectValue()
    if (
        rules["replace_levels"] is JsonArray &&
            rules["replace_levels"].arrayValue().none {
                it.number() == ownerLevel(parent.data, sheet)
            }
    )
        return 0
    return rules["replace_count"].number().coerceAtLeast(0)
}

fun selectedAbilityEligibility(
    item: CatalogueItem,
    parent: CatalogueItem,
    sheet: CharacterSheet,
): List<String> = buildList {
    if (item.data["selection_parent_id"].referenceId() != parent.id)
        add("Другой набор способностей.")
    if (ownerLevel(parent.data, sheet) < item.data["level"].number(1))
        add("Недостаточный уровень класса.")
    val abilities = sheet.values["abilities_class"].arrayValue().map { it.objectValue() }
    val spells = sheet.values["spells"].objectValue()
    val knownSpells =
        (spells["tabs"].arrayValue().flatMap { it.objectValue()["spells"].arrayValue() } +
                spells["grants"].arrayValue())
            .mapNotNull { it.referenceId() }
            .toSet()
    val requirements = item.data["selection_requirements"].objectValue()
    for (ability in requirements["abilities"].arrayValue()) if (
        abilities.none { it.referenceId() == ability.referenceId() }
    )
        add(
            "Требуется способность: ${ability.objectValue().label().ifBlank { "из выбранного набора" }}."
        )
    for (spell in requirements["spells"].arrayValue()) if (spell.referenceId() !in knownSpells)
        add(
            "Требуется заклинание: ${spell.objectValue().label().ifBlank { "из выбранного набора" }}."
        )
    for (raw in requirements["choices"].arrayValue()) {
        val requirement = raw.objectValue()
        val owner = abilities.firstOrNull {
            it.referenceId() == requirement["item_id"].referenceId()
        }
        val selected =
            owner.objectValue()["choices"].objectValue()[requirement.text("key")].arrayValue().map {
                it.jsonPrimitive.content
            }
        if (requirement["values"].arrayValue().none { it.jsonPrimitive.content in selected })
            add(requirement.text("label").ifBlank { "Требуется выбор другой способности." })
    }
}

fun validateEntryChoices(item: CatalogueItem, choices: JsonObject) {
    for (choice in itemChoices(item)) {
        val selected = choices[choice.text("key")].arrayValue()
        val actionable =
            choice["from_suggest_id"].referenceId() != null ||
                choice["from_item_type_id"].referenceId() != null ||
                choice["options"].arrayValue().isNotEmpty() ||
                choice["suggest_sources"].arrayValue().isNotEmpty()
        if (!actionable) continue
        require(
            selected.size == choice["count"].number(1).coerceAtLeast(1) &&
                selected.distinct().size == selected.size
        ) {
            "${item.name}: завершите выбор «${choice.text("label") }»."
        }
        require(
            choice.text("depends_on_choice").isBlank() ||
                choices[choice.text("depends_on_choice")].arrayValue().isNotEmpty()
        ) {
            "Сначала завершите зависимый выбор."
        }
    }
}

fun selectedAbilityEntries(sheet: CharacterSheet, parentId: Long, items: Map<Long, CatalogueItem>) =
    sheet.values["abilities_class"].arrayValue().filter {
        it.objectValue()["selection_source"].referenceId() == parentId ||
            items[it.referenceId()]?.data?.get("selection_parent_id").referenceId() == parentId
    }

fun applyAbilitySelection(
    sheet: CharacterSheet,
    parent: CatalogueItem,
    selections: List<JsonElement>,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata = HandbookMetadata(),
): List<SheetPatch> {
    val previous = selectedAbilityEntries(sheet, parent.id, items)
    val ids = selections.mapNotNull { it.referenceId() }
    require(
        ids.size == abilitySelectionCount(parent, sheet) && ids.distinct().size == selections.size
    ) {
        "Выберите ${abilitySelectionCount(parent, sheet)} разных способностей."
    }
    require(previous.count { it.referenceId() !in ids } <= abilityReplacementCount(parent, sheet)) {
        "Превышено число замен способностей."
    }
    val unrelated = sheet.values["abilities_class"].arrayValue() - previous.toSet()
    val chosen = selections.map { raw ->
        val id = raw.referenceId() ?: error("Выберите способность.")
        val old = previous.firstOrNull { it.referenceId() == id }.objectValue()
        JsonObject(
            old +
                raw.objectValue() +
                buildJsonObject {
                    put("id", id)
                    put("selection_source", parent.id)
                    if (old.isEmpty()) put("uid", java.util.UUID.randomUUID().toString())
                    if (old.isEmpty()) put("resource_version", 1)
                }
        )
    }
    val projected =
        sheet.copy(
            data =
                applySheetPatches(
                    sheet.data,
                    listOf(
                        SheetPatch(
                            path = sheetPath("values", "abilities_class"),
                            value = JsonArray(unrelated + chosen),
                        )
                    ),
                )
        )
    for (entry in chosen) {
        val item = items[entry.referenceId()] ?: error("Дождитесь загрузки выбранной способности.")
        val errors = selectedAbilityEligibility(item, parent, projected)
        require(errors.isEmpty()) { "${item.name}: ${errors.joinToString(" · ")}" }
        validateCharacterChoices(
            item,
            entry["choices"].objectValue(),
            projected,
            items,
            metadata,
            before = previous.firstOrNull { it.referenceId() == item.id }.objectValue(),
            current = entry,
        )
    }
    val removed = previous.mapNotNull { it.referenceId() }.toSet() - ids.toSet()
    val states =
        sheet.values["states"].arrayValue().filterNot {
            val source = it.objectValue()["source"].objectValue()
            source.text("kind") in setOf("ability", "feature_action") &&
                source["item_id"].referenceId() in removed
        }
    return listOf(
        SheetPatch(
            path = sheetPath("values", "abilities_class"),
            value = projected.values.getValue("abilities_class"),
        ),
        SheetPatch(path = sheetPath("values", "states"), value = JsonArray(states)),
    )
}
