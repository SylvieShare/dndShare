package ru.dndshare.client.character.creation

import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

internal fun applyCreationFeatureGrants(
    context: CreationContext,
    feats: List<CreationFeatSelection>,
    values: MutableMap<String, JsonElement>,
    proficiency: (String, String, List<Long>) -> Unit,
    skill: (Long, Int) -> Unit,
) {
    for (selection in feats) {
        val item = selection.item
        val grants = featGrants(item, selection.choices)
        for ((key, bucket, type) in
            listOf(
                Triple("armor_prof", "Доспехи", "3"),
                Triple("weapon_prof", "Оружие", "4"),
                Triple("tool_prof", "Инструменты", "5"),
                Triple("languages", "Языки", "6"),
            )) proficiency(bucket, type, grants[key].arrayValue().mapNotNull { it.referenceId() })
        grants["skill_prof"].arrayValue().mapNotNull { it.referenceId() }.forEach { skill(it, 1) }
        for (id in grants["save_prof"].arrayValue()) creationStats
            .getOrNull(id.number() - 1)
            ?.let { stat ->
                values[stat] =
                    JsonObject(values[stat].objectValue() + ("save_up" to JsonPrimitive(true)))
            }
    }
    val selections =
        (context.features(true) + context.features(false)).map {
            it to creationChoiceSelections(context, it.id.toString())
        } + feats.map { it.item to it.choices }
    for ((item, choices) in selections) for (choice in itemChoices(item)) {
        val selected = choices[choice.text("key")].arrayValue()
        if (
            choice["from_suggest_id"].number() == 15 &&
                item.data["derived_effects"].arrayValue().none {
                    it.objectValue().text("kind") == "skill_proficiency"
                }
        )
            selected
                .mapNotNull { it.referenceId() }
                .forEach { skill(it, if (choice["expertise"] == JsonPrimitive(true)) 2 else 1) }
        if (choice["from_suggest_id"].number() == 6)
            proficiency("Языки", "6", selected.mapNotNull { it.referenceId() })
    }
}
