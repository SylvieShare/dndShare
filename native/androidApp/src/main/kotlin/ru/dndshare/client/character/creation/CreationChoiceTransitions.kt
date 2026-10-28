package ru.dndshare.client.character.creation

import kotlinx.serialization.json.*
import ru.dndshare.client.character.changeCharacterChoice

fun pickCreationChoice(
    context: CreationContext,
    key: String,
    value: String,
    limit: Int,
): CreationDraft {
    val draft = context.draft
    val previous = draft.choices[key].orEmpty()
    val next =
        if (value in previous) previous - value
        else if (limit == 1) listOf(value)
        else if (previous.size < limit) previous + value else previous
    val choices = (draft.choices + (key to next)).toMutableMap()
    if ('|' in key) {
        val prefix = key.substringBefore('|')
        val item = context.items[prefix.removePrefix("origin:").toLongOrNull()]
        if (item != null) {
            val changed =
                changeCharacterChoice(
                    item,
                    creationChoiceSelections(context, prefix),
                    key.substringAfter('|'),
                    JsonArray(next.map(::JsonPrimitive)),
                )
            choices.keys.filter { it.startsWith("$prefix|") }.toList().forEach(choices::remove)
            for ((field, values) in changed) choices["$prefix|$field"] =
                values.jsonArray.map { it.jsonPrimitive.content }
        }
    }
    if (key in setOf("feats", "originFeat") || key.startsWith("selection:")) {
        for (removed in previous - next.toSet()) {
            val prefix = if (key == "originFeat") "origin:$removed|" else "$removed|"
            choices.keys.filter { it.startsWith(prefix) }.toList().forEach(choices::remove)
        }
    }
    return draft.copy(choices = choices)
}
