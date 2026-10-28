package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.character.initialFeatureInput

class AdvancementPreviewTest {
    private fun obj(value: String) = WireJson.parseToJsonElement(value).jsonObject

    private val warlock =
        CatalogueItem(
            11,
            9,
            "Колдун",
            "Warlock",
            obj(
                """{"hit_die":"d8","caster_progression":"pact","spellcasting":{"ability":6,"start_level":1,"list_class":11,"selection_mode":"known","known_progression":[{"level":1,"cantrips":2,"spells":2},{"level":4,"cantrips":3,"spells":5}]}}"""
            ),
        )
    private val fighter = CatalogueItem(14, 9, "Воин", "Fighter", obj("""{"hit_die":"d10"}"""))
    private val parent =
        CatalogueItem(
            10,
            4,
            "Воззвания",
            data =
                obj(
                    """{"class_ids":[11],"level":1,"ability_selection":{"counts":[{"level":1,"count":1},{"level":4,"count":2}],"replace_count":1,"replace_levels":[4]}}"""
                ),
        )
    private val first =
        CatalogueItem(12, 4, "Первое", data = obj("""{"selection_parent_id":10,"level":1}"""))
    private val second =
        CatalogueItem(
            13,
            4,
            "Требует заговор",
            data =
                obj(
                    """{"selection_parent_id":10,"level":4,"selection_requirements":{"spells":[{"id":22,"name":"Новый заговор"}]}}"""
                ),
        )
    private val spells =
        (20L..22L).map {
            CatalogueItem(it, 5, "Заговор", data = obj("""{"lvl":0,"classes":[11]}"""))
        }
    private val items =
        (listOf(warlock, fighter, parent, first, second) + spells).associateBy { it.id }
    private val sheet =
        CharacterSheet(
            "DND5",
            1,
            obj(
                """{"values":{"lvl":{"level":7},"classes":[{"id":11,"level":3,"name":"Колдун"},{"id":14,"level":4,"name":"Воин"}],"STR":{"value":{"base":13}},"CHA":{"value":{"base":16}},"CON":{"value":{"base":10}},"hp":{"max":{"base":20},"current":10,"hitDice":[]},"abilities_class":[{"id":10},{"id":12,"uid":"keep","count":1}],"states":[{"uid":"old-state","effect_id":40,"source":{"kind":"ability","item_id":12}}],"spells":{"schema_version":2,"tabs":[{"key":"book","name":"Книга","class_item_id":11,"casting_ability":6,"mode":"known","spells":[{"key":"a","id":20},{"key":"b","id":21}]}],"grants":[],"slot_pools":{"long_rest":[],"short_rest":[{"level":2,"total":2,"used":1}]}}}}"""
            ),
            1,
        )
    private val input =
        obj(
            """{"advance":true,"classId":11,"asiMode":"skip","selections":{"10":[12,13]},"spells":[20,21,22]}"""
        )

    @Test
    fun aSpellLearnedAtTheSameLevelUnlocksTheSelectedAbilityBeforeSaving() {
        val plan = LevelAdvancement(sheet, input, items)
        val preview = advancementPreview(plan)
        assertEquals(2, abilitySelectionCount(parent, preview))
        assertTrue(selectedAbilityEligibility(second, parent, sheet).isNotEmpty())
        assertTrue(selectedAbilityEligibility(second, parent, preview).isEmpty())
        val result = sheet.copy(data = applySheetPatches(sheet.data, levelAdvancementPatches(plan)))
        assertEquals(
            setOf(10L, 12L, 13L),
            result.values["abilities_class"].arrayValue().mapNotNull { it.referenceId() }.toSet(),
        )
        assertEquals(
            "keep",
            result.values["abilities_class"]
                .arrayValue()
                .first { it.referenceId() == 12L }
                .objectValue()
                .text("uid"),
        )
        assertTrue(findSpellReference(result, "a") != null)
    }

    @Test
    fun anotherClasssIncreaseCannotRaiseTheParentsBoundSelectionBudget() {
        val preview =
            advancementPreview(
                LevelAdvancement(
                    sheet,
                    JsonObject(
                        input +
                            mapOf(
                                "classId" to JsonPrimitive(14),
                                "selections" to obj("""{"10":[12]}"""),
                            )
                    ),
                    items,
                )
            )
        assertEquals(1, abilitySelectionCount(parent, preview))
        assertTrue(selectedAbilityEligibility(second, parent, preview).isNotEmpty())
    }

    @Test
    fun replacingAnImportedChildWithoutSelectionSourceRemovesItAndItsEffects() {
        val replacementParent =
            parent.copy(
                data =
                    obj(
                        """{"class_ids":[11],"ability_selection":{"counts":[{"level":1,"count":1}],"replace_count":1,"replace_levels":[4]}}"""
                    )
            )
        val replacement = second.copy(data = obj("""{"selection_parent_id":10,"level":1}"""))
        val catalogue = items + (10L to replacementParent) + (13L to replacement)
        assertEquals(
            listOf(12L),
            initialFeatureInput("ability-selection:10", sheet, catalogue)["entries"]
                .arrayValue()
                .mapNotNull { it.referenceId() },
        )
        val form =
            JsonObject(
                input +
                    mapOf(
                        "selections" to obj("""{"10":[13]}"""),
                        "spells" to JsonArray(listOf(JsonPrimitive(20), JsonPrimitive(21))),
                    )
            )
        val result =
            sheet.copy(
                data =
                    applySheetPatches(
                        sheet.data,
                        levelAdvancementPatches(LevelAdvancement(sheet, form, catalogue)),
                    )
            )
        assertTrue(result.values["abilities_class"].arrayValue().none { it.referenceId() == 12L })
        assertTrue(result.values["states"].arrayValue().isEmpty())
    }

    @Test
    fun dependentChoicesUseTheUncommittedSelectionWithoutChangingTheBaseline() {
        val dependent =
            second.copy(
                data =
                    obj(
                        """{"selection_parent_id":10,"level":1,"selection_requirements":{"choices":[{"item_id":12,"key":"focus","values":["arcane"]}]}}"""
                    )
            )
        val preview =
            abilitySelectionDraft(
                sheet,
                10,
                listOf(obj("""{"id":12,"choices":{"focus":["arcane"]}}""")),
                items,
            )
        assertTrue(selectedAbilityEligibility(dependent, parent, sheet).isNotEmpty())
        assertTrue(selectedAbilityEligibility(dependent, parent, preview).isEmpty())
        assertTrue(
            sheet.values["abilities_class"]
                .arrayValue()
                .first { it.referenceId() == 12L }
                .objectValue()["choices"]
                .objectValue()
                .isEmpty()
        )
    }
}
