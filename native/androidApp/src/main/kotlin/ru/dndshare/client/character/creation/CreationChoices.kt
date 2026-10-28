package ru.dndshare.client.character.creation

import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

data class CreationChoice(
    val key: String,
    val title: String,
    val count: Int,
    val options: List<Pair<String, String>>,
    val sourceItem: Long? = null,
    val choiceKey: String? = null,
    val invalidOptions: Map<String, String> = emptyMap(),
)

fun creationChoices(context: CreationContext, step: Int): List<CreationChoice> = buildList {
    val evaluation by lazy { creationEvaluation(context) }
    fun suggest(key: String, title: String, definition: JsonObject, type: String) {
        val count = definition["count"].number()
        if (count <= 0) return
        val allowed = definition["from"].arrayValue().mapNotNull { it.referenceId() }
        val options =
            context.metadata.suggests[type]
                .orEmpty()
                .filter { allowed.isEmpty() || it.id in allowed }
                .map { it.id.toString() to it.value }
        add(CreationChoice(key, title, count, options))
    }
    if (step == 1) {
        suggest("raceSkills", "Навыки происхождения", context.raceChoice("skill_choice"), "15")
        suggest("raceLanguages", "Языки происхождения", context.raceChoice("lang_choice"), "6")
        val asi = context.raceChoice("asi_choice")
        if (context.draft.version == "2014" && asi["count"].number() > 0)
            add(
                CreationChoice(
                    "asi",
                    "Прибавки характеристик +${asi["bonus"].number(1)}",
                    asi["count"].number(),
                    creationStats.zip(statTitles),
                )
            )
    }
    if (step == 2) {
        suggest("classSkills", "Навыки класса", context.classChoice("skill_choice"), "15")
        suggest(
            "classTools",
            "Владение инструментами",
            context.classChoice("tool_prof_choice"),
            "5",
        )
    }
    if (step == 3)
        suggest(
            "backgroundLanguages",
            "Языки предыстории",
            context.item("background")?.data?.get("lang_choice").objectValue(),
            "6",
        )
    if (step == 1) {
        val count = context.raceChoice("feat_choice")["count"].number()
        if (count > 0)
            add(
                CreationChoice(
                    "feats",
                    "Черты происхождения",
                    count,
                    context.catalogue
                        .filter {
                            it.typeId == 7L &&
                                (context.draft.version != "2024" ||
                                    it.data.text("category") == "origin")
                        }
                        .map { it.id.toString() to it.name },
                )
            )
    }
    if (step == 2) {
        val casting =
            context.classData
                .lastOrNull { it["spellcasting"] is JsonObject }
                ?.get("spellcasting")
                .objectValue()
        if (casting["start_level"].number(1) <= 1) {
            val classId = casting["list_class"].referenceId() ?: context.item("charClass")?.id
            for ((key, title, level) in
                listOf(
                    Triple("cantrips", "Заговоры", 0),
                    Triple("spells1", "Заклинания первого круга", 1),
                )) {
                val limit = casting[if (level == 0) "cantrips_known" else "spells_known"].number()
                if (limit > 0)
                    add(
                        CreationChoice(
                            key,
                            title,
                            limit,
                            context.catalogue
                                .filter {
                                    it.typeId == 5L &&
                                        it.data["lvl"].number() == level &&
                                        it.data["classes"].arrayValue().any { ref ->
                                            ref.referenceId() == classId
                                        }
                                }
                                .map { it.id.toString() to it.name },
                        )
                    )
            }
        }
        for (parent in
            context.features(false).filter { it.data["ability_selection"] is JsonObject }) {
            val count =
                parent.data["ability_selection"]
                    .objectValue()["counts"]
                    .arrayValue()
                    .map { it.objectValue() }
                    .filter { it["level"].number() <= 1 }
                    .maxByOrNull { it["level"].number() }
                    ?.get("count")
                    .number()
            if (count > 0)
                add(
                    CreationChoice(
                        "selection:${parent.id}",
                        parent.name,
                        count,
                        context.catalogue
                            .filter {
                                it.data["selection_parent_id"].referenceId() == parent.id &&
                                    it.data["level"].number(1) <= 1
                            }
                            .map { it.id.toString() to it.name },
                    )
                )
        }
    }
    if (step == 3) {
        val bg = context.item("background")?.data.objectValue()
        if (context.draft.version == "2024" && bg["origin_feat_id"].referenceId() == null)
            add(
                CreationChoice(
                    "originFeat",
                    "Черта происхождения",
                    1,
                    context.catalogue
                        .filter { it.typeId == 7L && it.data.text("category") == "origin" }
                        .map { it.id.toString() to it.name },
                )
            )
        for (raw in bg["item_choices"].arrayValue()) {
            val row = raw.objectValue()
            val equipment =
                !(context.draft.buyEquipment && context.draft.version == "2014") &&
                    context.picked("backgroundGold").firstOrNull() != "yes"
            if (
                row["grants_tool_proficiency"] == JsonPrimitive(true) ||
                    equipment && row["grants_equipment_item"] == JsonPrimitive(true)
            ) {
                val ids = row["option_item_ids"].arrayValue().mapNotNull { it.referenceId() }
                add(
                    CreationChoice(
                        "background:${row.text("key")}",
                        row.text("label").ifBlank { "Предмет предыстории" },
                        1,
                        context.catalogue
                            .filter { it.id in ids }
                            .map { it.id.toString() to it.name },
                    )
                )
            }
        }
    }
    val feats =
        creationFeatSelections(context, stableIds = true).filter {
            if (step == 1) !it.origin else step == 3 && it.origin
        }
    val features =
        when (step) {
            1 -> context.features(true)
            2 -> context.features(false)
            else -> emptyList()
        }
    val selectedFeatures =
        features.map { it to it.id.toString() } + feats.map { it.item to it.prefix }
    for ((item, prefix) in selectedFeatures.filter { it.first.typeId == 7L }) {
        val asi = item.data["asi_choice"].objectValue()
        if (asi.isNotEmpty()) {
            val key = asi.text("choice_key").ifBlank { "ability" }
            add(
                CreationChoice(
                    "$prefix|$key",
                    "${item.name} · прибавка характеристики",
                    asi["count"].number(1),
                    (1..6).map { it.toString() to statTitles[it - 1] },
                    item.id,
                    key,
                )
            )
        }
    }
    for ((item, prefix) in selectedFeatures) for ((index, definition) in
        itemChoices(item).withIndex()) {
        val key = definition.text("key").ifBlank { "choice_${index + 1}" }
        val selections = creationChoiceSelections(context, prefix)
        val options =
            characterChoiceOptions(
                definition,
                selections,
                context.catalogue.associateBy { it.id },
                context.metadata,
            )
        val unique =
            definition["unique_across_takes"] == JsonPrimitive(true) ||
                item.data.text("unique_choice_key") == key
        val occupied =
            if (unique)
                selectedFeatures
                    .filter { it.first.id == item.id && it.second != prefix }
                    .flatMap { context.picked("${it.second}|$key") }
                    .toSet()
            else emptySet()
        val needsRank =
            definition["requires_proficiency"] == JsonPrimitive(true) ||
                definition["exclude_rank"].number() > 0
        val invalid =
            options
                .mapNotNull { (value, _) ->
                    val reason =
                        if (value in occupied) "Этот вариант уже выбран другим экземпляром черты."
                        else if (needsRank) {
                            val owned = feats.firstOrNull { it.prefix == prefix }
                            val entry =
                                listOf(
                                        "abilities_race",
                                        "abilities_class",
                                        "abilities_feats",
                                        "abilities_story",
                                    )
                                    .flatMap { evaluation.values[it].arrayValue() }
                                    .map { it.objectValue() }
                                    .firstOrNull {
                                        it.referenceId() == item.id &&
                                            (owned == null ||
                                                it.text("uid") == owned.uid ||
                                                item.data["repeatable"] != JsonPrimitive(true))
                                    }
                                    .objectValue()
                            characterChoiceErrors(
                                    definition,
                                    value,
                                    choiceEvaluationSheet(evaluation, entry, key),
                                    context.items,
                                    context.metadata,
                                )
                                .firstOrNull()
                                .orEmpty()
                        } else ""
                    reason.takeIf(String::isNotBlank)?.let { value to it }
                }
                .toMap()
        add(
            CreationChoice(
                "$prefix|$key",
                item.name + " · " + definition.text("label").ifBlank { "Выбор" },
                definition["count"].number(1),
                options,
                item.id,
                key,
                invalid,
            )
        )
    }
}

fun itemChoices(item: CatalogueItem): List<JsonObject> {
    val data = item.data
    val rows =
        if (data["choices"] is JsonArray)
            data["choices"].arrayValue().filterIsInstance<JsonObject>()
        else listOfNotNull(data["choice"] as? JsonObject)
    return rows.mapIndexed { index, raw ->
        JsonObject(
            raw.objectValue() +
                mapOf(
                    "count" to JsonPrimitive(raw.objectValue()["count"].number(1).coerceAtLeast(1)),
                    "source" to
                        JsonPrimitive(
                            raw.objectValue().text("source").ifBlank {
                                when {
                                    raw.objectValue()["from_suggest_id"].referenceId() != null ->
                                        "suggest"
                                    raw.objectValue()["from_item_type_id"].referenceId() != null ->
                                        "item"
                                    else -> "inline"
                                }
                            }
                        ),
                    "key" to
                        (raw.objectValue()["key"]
                            ?: JsonPrimitive(
                                if (data["choices"] is JsonArray) "choice_${index + 1}"
                                else "choice"
                            )),
                )
        )
    }
}

fun itemChoiceMatches(item: CatalogueItem, filter: JsonElement?): Boolean {
    if (filter == null || filter == JsonNull) return true
    val fields =
        if (filter is JsonObject) filter
        else {
            val text = (filter as? JsonPrimitive)?.content.orEmpty()
            runCatching { WireJson.parseToJsonElement(text).jsonObject }
                .getOrElse {
                    if ('=' !in text) return true
                    JsonObject(
                        mapOf(text.substringBefore('=') to JsonPrimitive(text.substringAfter('=')))
                    )
                }
        }
    fun values(node: JsonElement?, parts: List<String>): List<JsonElement> =
        when {
            node is JsonArray -> node.flatMap { values(it, parts) }
            parts.isEmpty() -> listOfNotNull(node)
            node is JsonObject -> values(node[parts.first()], parts.drop(1))
            else -> emptyList()
        }
    return fields.all { (key, expected) ->
        val allowed = if (expected is JsonArray) expected.toList() else listOf(expected)
        values(item.data, key.split('.')).any { actual ->
            allowed.any { it.toString().trim('"') == actual.toString().trim('"') }
        }
    }
}
