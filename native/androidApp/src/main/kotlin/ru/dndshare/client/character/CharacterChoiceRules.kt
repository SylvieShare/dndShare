package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.creation.*
import ru.dndshare.client.model.*

fun choiceFilter(choice: JsonObject, selections: JsonObject): JsonObject? {
    val raw = choice["item_filter"]
    val base =
        if (raw is JsonObject) raw
        else {
            val text = (raw as? JsonPrimitive)?.content.orEmpty()
            runCatching { WireJson.parseToJsonElement(text).jsonObject }
                .getOrElse {
                    if ('=' in text)
                        buildJsonObject {
                            put(text.substringBefore('=').trim(), text.substringAfter('=').trim())
                        }
                    else JsonObject(emptyMap())
                }
        }
    val dynamic = choice["item_filter_from_choice"].objectValue()
    if (dynamic.text("path").isBlank() || dynamic.text("choice_key").isBlank()) return base
    val values = selections[dynamic.text("choice_key")].arrayValue()
    if (values.isEmpty()) return null
    return JsonObject(base + (dynamic.text("path") to (values.singleOrNull() ?: JsonArray(values))))
}

fun choiceDependencies(choice: JsonObject): Set<String> =
    setOf(
            choice.text("depends_on_choice"),
            choice["item_filter_from_choice"].objectValue().text("choice_key"),
        )
        .filter(String::isNotBlank)
        .toSet()

fun characterChoiceOptions(
    choice: JsonObject,
    selections: JsonObject,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
): List<Pair<String, String>> =
    when (choice.text("source")) {
        "suggest" ->
            metadata.suggests[choice.text("from_suggest_id")].orEmpty().map {
                it.id.toString() to it.value
            }
        "suggest_union" ->
            choice["suggest_sources"].arrayValue().flatMap { raw ->
                val row = raw.objectValue()
                val type = row.text("suggest_id").ifBlank { row.text("type_id") }
                metadata.suggests[type].orEmpty().map {
                    "${row.text("prefix").ifBlank { type }}:${it.id}" to it.value
                }
            }
        "item" -> {
            val filter = choiceFilter(choice, selections)
            if (choiceDependencies(choice).any { selections[it].arrayValue().isEmpty() })
                emptyList()
            else
                items.values
                    .filter {
                        it.typeId == choice["from_item_type_id"].referenceId() &&
                            itemChoiceMatches(it, filter)
                    }
                    .map { it.id.toString() to it.name }
        }
        else ->
            choice["options"].arrayValue().map { raw ->
                raw.objectValue().let {
                    it.text("value").ifBlank { it.text("label") } to
                        it.text("label").ifBlank { it.text("value") }
                }
            }
    }

fun characterChoiceRank(
    value: String,
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
): Int {
    val kind = value.substringBefore(':', "")
    val id = value.substringAfter(':', "").toLongOrNull() ?: return 0
    val rules = DndDerivedValues(sheet, items, metadata)
    return when (kind) {
        "skill" ->
            maxOf(
                creationStats.maxOf { stat ->
                    sheet.values[stat]
                        .objectValue()["skills"]
                        .objectValue()[id.toString()]
                        .objectValue()["up"]
                        .number()
                },
                rules.rank("skill_proficiency", RuleContext(kind = "skill_check", skill = id)),
            )
        "tool" -> {
            val label = metadata.suggests["5"].orEmpty().firstOrNull { it.id == id }?.value
            val owned =
                sheet.values["proficiencies"].objectValue()["Инструменты"].arrayValue().any { raw ->
                    val name =
                        if (raw is JsonObject) raw.text("name").ifBlank { raw.text("value") }
                        else (raw as? JsonPrimitive)?.content.orEmpty()
                    label != null && name.trim().equals(label.trim(), true)
                }
            maxOf(
                if (owned) 1 else 0,
                rules.rank(
                    "tool_proficiency",
                    RuleContext(kind = "tool", target = JsonPrimitive(id)),
                ),
            )
        }
        else -> 0
    }
}

fun characterChoiceErrors(
    choice: JsonObject,
    value: String,
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
): List<String> = buildList {
    if (
        choice["requires_proficiency"] != JsonPrimitive(true) &&
            choice["exclude_rank"].number() <= 0
    )
        return@buildList
    val rank = characterChoiceRank(value, sheet, items, metadata)
    if (choice["requires_proficiency"] == JsonPrimitive(true) && rank < 1)
        add("Сначала нужно получить владение")
    val excluded = choice["exclude_rank"].number()
    if (excluded > 0 && rank >= excluded) add("Уже имеет ранг владения $excluded")
}

fun occupiedCharacterChoices(
    item: CatalogueItem,
    choice: JsonObject,
    sheet: CharacterSheet,
    current: JsonObject = JsonObject(emptyMap()),
): Set<String> {
    val key = choice.text("key")
    if (
        choice["unique_across_takes"] != JsonPrimitive(true) &&
            item.data.text("unique_choice_key") != key
    )
        return emptySet()
    return listOf("abilities_class", "abilities_race", "abilities_feats", "abilities_story")
        .flatMap { sheet.values[it].arrayValue() }
        .map { it.objectValue() }
        .filter { it.referenceId() == item.id && it != current }
        .flatMap { it["choices"].objectValue()[key].arrayValue() }
        .map { it.jsonPrimitive.content }
        .toSet()
}

/** Static/dynamic validity always applies; a retained expertise pick need not qualify twice. */
fun validateCharacterChoices(
    item: CatalogueItem,
    choices: JsonObject,
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
    before: JsonObject = JsonObject(emptyMap()),
    current: JsonObject = before,
) {
    validateEntryChoices(item, choices)
    for (choice in itemChoices(item)) {
        val key = choice.text("key")
        val selected = choices[key].arrayValue().map { it.jsonPrimitive.content }
        if (selected.isEmpty()) continue
        if (
            choice["from_suggest_id"].referenceId() == null &&
                choice["from_item_type_id"].referenceId() == null &&
                choice["options"].arrayValue().isEmpty() &&
                choice["suggest_sources"].arrayValue().isEmpty()
        )
            continue
        val options =
            characterChoiceOptions(choice, choices, items, metadata).map { it.first }.toSet()
        require(selected.all { it in options }) {
            "${item.name}: выбранный вариант больше не соответствует условиям «${choice.text("label")}»."
        }
        val retained =
            before["choices"]
                .objectValue()[key]
                .arrayValue()
                .map { it.jsonPrimitive.content }
                .toSet()
        for (value in selected.filterNot { it in retained }) {
            val errors =
                characterChoiceErrors(
                    choice,
                    value,
                    choiceEvaluationSheet(sheet, current, key),
                    items,
                    metadata,
                )
            require(errors.isEmpty()) { "${item.name}: ${errors.joinToString(" · ")}" }
        }
        val occupied = occupiedCharacterChoices(item, choice, sheet, current)
        require(selected.none { it in occupied }) {
            "${item.name}: этот вариант уже выбран другим экземпляром черты."
        }
    }
}

/** A parent switch clears its dependent draft selections as the web choice dialog does. */
fun changeCharacterChoice(
    item: CatalogueItem,
    choices: JsonObject,
    key: String,
    value: JsonArray,
): JsonObject {
    val result = choices.toMutableMap()
    result[key] = value
    val queue = ArrayDeque(listOf(key))
    val seen = mutableSetOf<String>()
    while (queue.isNotEmpty()) {
        val parent = queue.removeFirst()
        if (!seen.add(parent)) continue
        for (choice in itemChoices(item).filter { parent in choiceDependencies(it) }) {
            val child = choice.text("key")
            if (child == key) continue
            result[child] = JsonArray(emptyList())
            queue.add(child)
        }
    }
    return JsonObject(result)
}

/** Exclude only this pending choice's own derived rank; other grants/instances still qualify. */
fun choiceEvaluationSheet(sheet: CharacterSheet, current: JsonObject, key: String): CharacterSheet {
    if (current.isEmpty()) return sheet
    val values = sheet.values.toMutableMap()
    for (bucket in
        listOf("abilities_class", "abilities_race", "abilities_feats", "abilities_story")) {
        if (bucket !in values) continue
        values[bucket] =
            JsonArray(
                values[bucket].arrayValue().map { raw ->
                    val row = raw.objectValue()
                    if (row != current) row
                    else
                        JsonObject(
                            row +
                                ("choices" to
                                    JsonObject(
                                        row["choices"].objectValue() +
                                            (key to JsonArray(emptyList()))
                                    ))
                        )
                }
            )
    }
    return sheet.copy(data = JsonObject(sheet.data + ("values" to JsonObject(values))))
}

fun validateChangedCharacterChoices(
    before: CharacterSheet,
    after: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
) {
    val old = ownedFeatures(before, items)
    for (feature in ownedFeatures(after, items)) {
        val previous =
            old.firstOrNull {
                    it.key == feature.key && featureEntryKey(it) == featureEntryKey(feature)
                }
                ?.entry ?: JsonObject(emptyMap())
        if (previous.isEmpty() || previous["choices"] != feature.entry["choices"])
            validateCharacterChoices(
                feature.item,
                feature.entry["choices"].objectValue(),
                after,
                items,
                metadata,
                previous,
                feature.entry,
            )
    }
}
