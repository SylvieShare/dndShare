package ru.dndshare.client.character.creation

import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

internal fun applyCreationAttributes(
    context: CreationContext,
    feats: List<CreationFeatSelection>,
    values: MutableMap<String, JsonElement>,
): Map<String, Int> {
    val draft = context.draft
    val scoreInputs = creationScores(draft)
    val finalScores = linkedMapOf<String, Int>()
    for ((index, stat) in creationStats.withIndex()) {
        val base = scoreInputs[stat] ?: 10
        var bonus =
            if (draft.version == "2024") draft.backgroundAsi[stat] ?: 0
            else
                context.raceOffers.sumOf { row ->
                    row["asi"].arrayValue().sumOf { value ->
                        val asi = value.objectValue()
                        if (asi["ability"].number() == index + 1) asi["bonus"].number() else 0
                    }
                } +
                    if (stat in context.picked("asi"))
                        context.raceChoice("asi_choice")["bonus"].number(1)
                    else 0
        val bonuses = mutableListOf<JsonElement>()
        if (bonus != 0)
            bonuses.add(
                buildJsonObject {
                    put(
                        "name",
                        context.item(if (draft.version == "2024") "background" else "race")?.name
                            ?: "Происхождение",
                    )
                    put(
                        "title",
                        context.item(if (draft.version == "2024") "background" else "race")?.name
                            ?: "Происхождение",
                    )
                    put("value", bonus)
                    put("readonly", true)
                }
            )
        var score = base + bonus
        for (selection in feats) {
            val feat = selection.item
            bonus =
                featAbilityBonus(feat, selection.choices, index + 1)
                    .coerceAtMost((20 - score).coerceAtLeast(0))
            if (bonus != 0) {
                score += bonus
                bonuses.add(
                    buildJsonObject {
                        put("name", feat.name)
                        put("title", feat.name)
                        put("value", bonus)
                        put("readonly", true)
                        put("sourceFeatKey", "feat:${selection.uid}")
                    }
                )
            }
        }
        values[stat] = buildJsonObject {
            put(
                "value",
                buildJsonObject {
                    put("base", base)
                    put("bonuses", JsonArray(bonuses))
                },
            )
        }
        finalScores[stat] = score
    }
    return finalScores
}

private fun featAbilityBonus(feat: CatalogueItem, choices: JsonObject, ability: Int): Int {
    var total =
        feat.data["asi"].arrayValue().sumOf {
            val row = it.objectValue()
            if (row["ability"].number() == ability) row["bonus"].number() else 0
        }
    val asi = feat.data["asi_choice"].objectValue()
    if (
        choices[asi.text("choice_key").ifBlank { "ability" }].arrayValue().any {
            it.number() == ability
        }
    )
        total += asi["bonus"].number()
    for (choice in itemChoices(feat)) if (
        choices[choice.text("key")].arrayValue().any { it.number() == ability }
    )
        total += choice["ability_bonus"].number()
    return total
}
