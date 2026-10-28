package ru.dndshare.client.character.creation

import kotlinx.serialization.json.*

/** Invalidate only choices owned by the changed source; other wizard steps keep their work. */
fun chooseCreationItem(context: CreationContext, key: String, id: Long): CreationDraft {
    val draft = context.draft
    if (draft.selected[key] == id) return draft
    val selected =
        draft.selected.toMutableMap().apply {
            put(key, id)
            if (key == "race") remove("subrace")
            if (key == "charClass") remove("subclass")
        }
    val next = draft.copy(selected = selected)
    return resetCreationSource(context, context.copy(draft = next), key)
}

fun chooseCreationVariant(context: CreationContext, value: String): CreationDraft {
    if (context.draft.raceVariant == value) return context.draft
    return resetCreationSource(
        context,
        context.copy(draft = context.draft.copy(raceVariant = value)),
        "variant",
    )
}

private fun resetCreationSource(
    before: CreationContext,
    after: CreationContext,
    key: String,
): CreationDraft {
    val race = key in setOf("race", "subrace", "variant")
    val characterClass = key in setOf("charClass", "subclass")
    val background = key == "background"
    val owners =
        when {
                race -> before.features(true) + after.features(true) + before.selectedItems("feats")
                characterClass -> before.features(false) + after.features(false)
                else -> emptyList()
            }
            .map { it.id.toString() }
            .toSet()
    val fields =
        when {
            race -> setOf("raceSkills", "raceLanguages", "asi", "feats")
            characterClass -> setOf("classSkills", "classTools", "spells", "cantrips", "spells1")
            background -> setOf("backgroundLanguages", "backgroundGold", "originFeat")
            else -> emptySet()
        }
    return after.draft.copy(
        choices =
            after.draft.choices.filterKeys { field ->
                field !in fields &&
                    field.substringBefore('|') !in owners &&
                    !(characterClass && field.startsWith("selection:")) &&
                    !(background &&
                        (field.startsWith("background:") || field.startsWith("origin:")))
            },
        raceVariant = if (key == "race") "" else after.draft.raceVariant,
        equipmentChoices =
            if (characterClass) JsonObject(emptyMap()) else after.draft.equipmentChoices,
        wealth = if (characterClass) null else after.draft.wealth,
        backgroundAsi = if (background) emptyMap() else after.draft.backgroundAsi,
    )
}
