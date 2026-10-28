package ru.dndshare.client.character.creation

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

val creationStats = listOf("STR", "DEX", "CON", "INT", "WIS", "CHA")
val statTitles = listOf("Сила", "Ловкость", "Телосложение", "Интеллект", "Мудрость", "Харизма")

@Serializable
data class CreationDraft(
    val template: String = "DND5",
    val version: String = "2014",
    val editionId: Long = 0,
    val step: Int = 0,
    val name: String = "",
    val selected: Map<String, Long> = emptyMap(),
    val choices: Map<String, List<String>> = emptyMap(),
    val raceVariant: String = "",
    val method: String = "array",
    val scores: Map<String, Int> = emptyMap(),
    val assignments: Map<String, Int> = emptyMap(),
    val rolls: List<List<Int>> = emptyList(),
    val backgroundAsi: Map<String, Int> = emptyMap(),
    val media: Map<String, String> = emptyMap(),
    val portraitUpload: JsonObject? = null,
    val iconUploadId: Long? = null,
    val persona: Map<String, String> = emptyMap(),
    val equipmentChoices: JsonObject = JsonObject(emptyMap()),
    val buyEquipment: Boolean = false,
    val wealth: JsonObject? = null,
    val cart: List<JsonObject> = emptyList(),
    val contentSources: JsonObject = buildJsonObject {
        put("mode", "all")
        put("ids", JsonArray(emptyList()))
        put("allowLegacy", false)
    },
)

data class CreationContext(
    val draft: CreationDraft,
    val allItems: List<CatalogueItem>,
    val metadata: HandbookMetadata,
    val rules: JsonObject,
) {
    val catalogue = allItems.filter { contentSourceEligible(it, draft.contentSources) }
    val items = allItems.associateBy { it.id }

    fun item(key: String) = catalogue.firstOrNull { it.id == draft.selected[key] }

    fun picked(key: String): List<String> =
        if (key == "spells")
            (draft.choices["cantrips"].orEmpty() + draft.choices["spells1"].orEmpty()).distinct()
        else draft.choices[key].orEmpty()

    fun selectedItems(key: String) = picked(key).mapNotNull { it.toLongOrNull()?.let(items::get) }

    fun label(type: String, id: Long) =
        metadata.suggests[type]?.firstOrNull { it.id == id }?.value.orEmpty()

    val raceData
        get() = listOfNotNull(item("race"), item("subrace")).map { it.data }

    val classData
        get() = listOfNotNull(item("charClass"), item("subclass")).map { it.data }

    val variant
        get() =
            raceData
                .flatMap { it["variants"].arrayValue() }
                .map { it.objectValue() }
                .firstOrNull { it.text("value") == draft.raceVariant }

    val raceOffers
        get() = raceData + listOfNotNull(variant)

    fun raceChoice(key: String) =
        raceOffers.lastOrNull { it[key] is JsonObject }?.get(key).objectValue()

    fun classChoice(key: String) =
        classData.lastOrNull { it[key] is JsonObject }?.get(key).objectValue()

    fun features(race: Boolean, level: Int = 1): List<CatalogueItem> {
        val fixed = catalogue.filter { item ->
            val data = item.data
            if (
                item.typeId != (if (race) 3L else 4L) ||
                    data["selection_parent_id"] != null &&
                        data["selection_parent_id"] != JsonNull ||
                    data["level"].number(1) > level
            )
                false
            else {
                val main = if (race) "race" else "charClass"
                val sub = if (race) "subrace" else "subclass"
                val ids =
                    data[if (race) "race_ids" else "class_ids"].arrayValue().mapNotNull {
                        it.referenceId()
                    }
                val children =
                    data[if (race) "subrace_ids" else "subclass_ids"].arrayValue().mapNotNull {
                        it.referenceId()
                    }
                draft.selected[main] in ids &&
                    (children.isEmpty() || draft.selected[sub] in children)
            }
        }
        if (race) return fixed
        return (fixed + fixed.flatMap { parent -> selectedItems("selection:${parent.id}") })
            .distinctBy { it.id }
    }

    fun children(key: String): List<CatalogueItem> {
        val race = key == "subrace"
        val parent = item(if (race) "race" else "charClass") ?: return emptyList()
        val ids =
            parent.data[if (race) "subraces" else "subclasses"].arrayValue().mapNotNull {
                it.referenceId()
            }
        return catalogue.filter {
            it.typeId == (if (race) 16L else 17L) &&
                (it.id in ids || it.data[if (race) "race" else "class"].referenceId() == parent.id)
        }
    }
}

fun creationScores(draft: CreationDraft): Map<String, Int> =
    when (draft.method) {
        "point" -> creationStats.associateWith { draft.scores[it] ?: 8 }
        else -> {
            val pool =
                if (draft.method == "roll") draft.rolls.map { it.sortedDescending().take(3).sum() }
                else listOf(15, 14, 13, 12, 10, 8)
            creationStats
                .mapNotNull { stat ->
                    draft.assignments[stat]?.let { pool.getOrNull(it) }?.let { stat to it }
                }
                .toMap()
        }
    }

fun pointBuyRemaining(draft: CreationDraft): Int {
    val cost = mapOf(8 to 0, 9 to 1, 10 to 2, 11 to 3, 12 to 4, 13 to 5, 14 to 7, 15 to 9)
    return 27 - creationStats.sumOf { cost[draft.scores[it] ?: 8] ?: 1000 }
}
