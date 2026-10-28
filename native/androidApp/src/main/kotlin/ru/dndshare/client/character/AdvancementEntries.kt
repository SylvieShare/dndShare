package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

internal fun advancementFeatureEntry(
    item: CatalogueItem,
    plan: LevelAdvancement,
    sheet: CharacterSheet,
): JsonObject {
    val choices = plan.choices(item)
    validateEntryChoices(item, choices)
    val asi = item.data["asi_choice"].objectValue()
    if (asi.isNotEmpty()) {
        val selected = choices[asi.text("choice_key").ifBlank { "ability" }].arrayValue()
        require(
            selected.size == asi["count"].number(1) &&
                selected.distinct().size == selected.size &&
                selected.all { it.number() in 1..6 }
        ) {
            "Выберите прибавку характеристики."
        }
    }
    val entry = buildJsonObject {
        put("id", item.id)
        if (choices.isNotEmpty()) put("choices", choices)
        if (
            item.data["selection_parent_id"].referenceId() != null ||
                item.data["repeatable"] == JsonPrimitive(true)
        )
            put("uid", java.util.UUID.randomUUID().toString())
        item.data["selection_parent_id"].referenceId()?.let {
            put("selection_source", it)
        }
    }
    val total = resourceMaximum(item.data, item, entry, sheet)
    return JsonObject(
        entry +
            buildMap {
                if (total != null) {
                    put("count", JsonPrimitive(total))
                    put("resource_version", JsonPrimitive(1))
                }
                if (item.data["use_resources"].arrayValue().isNotEmpty())
                    put("resource_version", JsonPrimitive(1))
                if (item.data["manual_size"] == JsonPrimitive(true))
                    put("max_use", JsonPrimitive(total ?: 0))
            }
    )
}
