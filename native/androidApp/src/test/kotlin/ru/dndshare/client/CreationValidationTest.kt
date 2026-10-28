package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.character.creation.*
import ru.dndshare.client.model.*

class CreationValidationTest {
    private fun obj(value: String) = WireJson.parseToJsonElement(value).jsonObject

    private val race =
        CatalogueItem(81, 8, "Человек", data = obj("""{"feat_choice":{"count":1}}"""))
    private val fighter = CatalogueItem(91, 9, "Воин", "Fighter", obj("""{"hit_die":"d10"}"""))
    private val feat =
        CatalogueItem(
            77,
            7,
            "Требовательная черта",
            data =
                obj("""{"prereq":{"min_stats":[{"ability":1,"value":20}],"spellcasting":true}}"""),
        )

    private fun context(draft: CreationDraft, items: List<CatalogueItem>) =
        CreationContext(draft, items, HandbookMetadata(), JsonObject(emptyMap()))

    @Test
    fun aFighterCannotSatisfySpellcastingWithAnInventedEmptyBook() {
        val draft =
            CreationDraft(
                method = "point",
                scores = creationStats.associateWith { 8 },
                selected = mapOf("race" to 81, "charClass" to 91),
                choices = mapOf("feats" to listOf("77")),
            )
        val context = context(draft, listOf(race, fighter, feat))
        assertNull(creationEvaluation(context).values["spells"])
        val errors = creationErrors(context, 4)
        assertTrue(errors.any { it.contains("Способность накладывать") })
        assertTrue(errors.any { it.contains("Сила 20") })
    }

    @Test
    fun classChoicesCanRequireASpellSelectedOnThatSameWizardStep() {
        val caster =
            fighter.copy(
                data =
                    obj(
                        """{"hit_die":"d10","caster_progression":"full","spellcasting":{"ability":4,"start_level":1,"list_class":91,"cantrips_known":1}}"""
                    )
            )
        val parent =
            CatalogueItem(
                10,
                4,
                "Набор",
                data =
                    obj(
                        """{"class_ids":[91],"ability_selection":{"counts":[{"level":1,"count":1}]}}"""
                    ),
            )
        val child =
            CatalogueItem(
                12,
                4,
                "Выбор",
                data =
                    obj(
                        """{"selection_parent_id":10,"selection_requirements":{"spells":[{"id":22}]}}"""
                    ),
            )
        val spell = CatalogueItem(22, 5, "Огонёк", data = obj("""{"lvl":0,"classes":[91]}"""))
        val draft =
            CreationDraft(
                selected = mapOf("charClass" to 91),
                choices = mapOf("selection:10" to listOf("12")),
            )
        val items = listOf(caster, parent, child, spell)
        assertTrue(
            creationErrors(context(draft, items), 2).any { it.contains("Требуется заклинание") }
        )
        val ready =
            context(draft.copy(choices = draft.choices + ("cantrips" to listOf("22"))), items)
        assertTrue(creationErrors(ready, 2).isEmpty(), creationErrors(ready, 2).joinToString())
        assertEquals(creationEvaluation(ready).data, creationEvaluation(ready).data)
    }

    @Test
    fun duplicateIdsInARestoredDraftCannotFillMultipleChoiceSlots() {
        val draft =
            CreationDraft(
                selected = mapOf("race" to 81),
                choices = mapOf("feats" to listOf("77", "77")),
            )
        val origin = race.copy(data = obj("""{"feat_choice":{"count":2}}"""))
        assertTrue(
            creationErrors(context(draft, listOf(origin, feat)), 1).any {
                it.contains("Черты происхождения")
            }
        )
    }

    @Test
    fun addingAMagicalFeatureToANonCasterCreatesOnlyTheRequiredCanonicalBook() {
        val nonCaster =
            CharacterSheet(
                "DND5",
                1,
                obj(
                    """{"values":{"lvl":{"level":1},"abilities_feats":[{"id":77,"choices":{"spell":[22]}}]}}"""
                ),
                1,
            )
        val magical =
            feat.copy(
                data =
                    obj(
                        """{"choices":[{"key":"spell","from_item_type_id":5,"grant_spells":true,"casting_ability":4}]}"""
                    )
            )
        val spell = CatalogueItem(22, 5, "Огонёк", data = obj("""{"lvl":0}"""))
        val changed =
            nonCaster.copy(
                data =
                    applySheetPatches(
                        nonCaster.data,
                        abilitySpellGrantPatches(nonCaster, mapOf(77L to magical, 22L to spell)),
                    )
            )
        assertEquals(JsonPrimitive(2), changed.values["spells"].objectValue()["schema_version"])
        assertEquals(
            JsonPrimitive(22),
            changed.values["spells"]
                .objectValue()["grants"]
                .arrayValue()
                .single()
                .objectValue()["id"],
        )
        assertTrue(changed.values["spells"].objectValue()["tabs"].arrayValue().isEmpty())
        val mundane =
            nonCaster.copy(data = obj("""{"values":{"lvl":{"level":1},"abilities_feats":[]}}"""))
        assertTrue(abilitySpellGrantPatches(mundane, emptyMap()).isEmpty())
    }
}
