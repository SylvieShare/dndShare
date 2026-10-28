package ru.dndshare.client.ui.character

import coil3.ImageLoader
import ru.dndshare.client.character.*
import ru.dndshare.client.model.HandbookMetadata
import ru.dndshare.client.ui.RichInteractions

internal fun spellRichInteractions(base: RichInteractions, readout: SpellReadout, castLevel: Int) =
    base.copy(
        variables =
            base.variables +
                mapOf(
                    "casting_mod" to readout.modifier.toDouble(),
                    "cast_level" to castLevel.toDouble(),
                    "spell_dc" to readout.save.toDouble(),
                    "spell_attack" to readout.attack.toDouble(),
                )
    )

internal fun sheetRichInteractions(
    sheet: CharacterSheet,
    mechanics: DndDerivedValues,
    metadata: HandbookMetadata,
    images: ImageLoader,
    roll: (SheetRollRequest) -> Unit,
): RichInteractions =
    RichInteractions(
        variables =
            listOf("STR", "DEX", "CON", "INT", "WIS", "CHA").associate {
                "${it.lowercase()}_mod" to abilityModifier(mechanics.score(it)).toDouble()
            } +
                mapOf(
                    "prof_bonus" to sheet.proficiency().toDouble(),
                    "char_level" to sheet.values["lvl"].objectValue()["level"].number(1).toDouble(),
                ),
        metadata = metadata,
        images = images,
        roll = { title, formula -> roll(SheetRollRequest(title, formula = formula)) },
    )
