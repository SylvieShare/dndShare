package ru.dndshare.client.character.creation

import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

/** Eligibility uses the same producer as Save, without shop side effects or random preview keys. */
fun creationEvaluation(context: CreationContext): CharacterSheet =
    CharacterSheet(
        "DND5",
        0,
        assembleCharacter(context, includePossessions = false, stableIds = true),
        0,
        sourceVersion = context.draft.version,
    )

fun creationFeats(context: CreationContext): List<CatalogueItem> =
    creationFeatSelections(context, stableIds = true).map { it.item }
