package ru.dndshare.client.character.creation

import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

data class CreationFeatSelection(
    val item: CatalogueItem,
    val prefix: String,
    val uid: String,
    val choices: JsonObject,
    val origin: Boolean,
)

fun creationChoiceSelections(context: CreationContext, prefix: String): JsonObject =
    JsonObject(
        context.draft.choices
            .filterKeys { it.startsWith(prefix + "|") }
            .mapKeys { it.key.removePrefix(prefix + "|") }
            .mapValues { (_, values) ->
                JsonArray(
                    values.map { it.toLongOrNull()?.let(::JsonPrimitive) ?: JsonPrimitive(it) }
                )
            }
    )

fun creationFeatSelections(
    context: CreationContext,
    stableIds: Boolean = false,
): List<CreationFeatSelection> {
    val race = context.selectedItems("feats")
    val origin =
        if (context.draft.version == "2024")
            context
                .item("background")
                ?.data
                ?.get("origin_feat_id")
                .referenceId()
                ?.let(context.items::get) ?: context.selectedItems("originFeat").firstOrNull()
        else null
    fun entry(item: CatalogueItem, background: Boolean, index: Int): CreationFeatSelection {
        val prefix = if (background) "origin:" + item.id else item.id.toString()
        val uid =
            if (item.data["repeatable"] == JsonPrimitive(true)) {
                if (stableIds) "preview-feat:" + prefix + ":" + index
                else UUID.randomUUID().toString()
            } else item.id.toString()
        return CreationFeatSelection(
            item,
            prefix,
            uid,
            creationChoiceSelections(context, prefix),
            background,
        )
    }
    return race.mapIndexed { index, item -> entry(item, false, index) } +
        listOfNotNull(
            origin
                ?.takeIf { item ->
                    item.data["repeatable"] == JsonPrimitive(true) || race.none { it.id == item.id }
                }
                ?.let { entry(it, true, race.size) }
        )
}

internal fun creationFeatEntry(
    selection: CreationFeatSelection,
    values: Map<String, JsonElement>,
): JsonObject {
    val item = selection.item
    val sheet = CharacterSheet("DND5", 0, buildJsonObject { put("values", JsonObject(values)) }, 0)
    val maximum = resourceMaximum(item.data, item, JsonObject(emptyMap()), sheet)
    return buildJsonObject {
        put("id", item.id)
        put("count", maximum ?: 0)
        if (maximum != null || item.data["use_resources"].arrayValue().isNotEmpty())
            put("resource_version", 1)
        if (item.data["manual_size"] == JsonPrimitive(true)) put("max_use", maximum ?: 0)
        if (item.data["repeatable"] == JsonPrimitive(true)) put("uid", selection.uid)
        if (selection.choices.isNotEmpty()) put("choices", selection.choices)
    }
}
