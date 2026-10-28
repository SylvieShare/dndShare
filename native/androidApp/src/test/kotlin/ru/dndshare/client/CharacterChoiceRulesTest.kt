package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.character.creation.*
import ru.dndshare.client.model.*

class CharacterChoiceRulesTest {
    private fun obj(s: String) = WireJson.parseToJsonElement(s).jsonObject

    private fun sheet(values: String) =
        CharacterSheet("DND5", 1, buildJsonObject { put("values", obj(values)) }, 1)

    @Test
    fun uniqueRepeatableChoicesExcludeOtherInstancesButKeepTheirOwnSelection() {
        val item =
            CatalogueItem(
                7,
                7,
                "Повторяемый дар",
                data =
                    obj(
                        """{"repeatable":true,"choices":[{"key":"style","unique_across_takes":true,"options":[{"value":"a"},{"value":"b"}]}]}"""
                    ),
            )
        val base =
            sheet("""{"abilities_feats":[{"id":7,"uid":"first","choices":{"style":["a"]}}]}""")
        val first = base.values["abilities_feats"].arrayValue().single().objectValue()
        val items = mapOf(7L to item)
        validateCharacterChoices(
            item,
            first["choices"].objectValue(),
            base,
            items,
            HandbookMetadata(),
            first,
        )
        assertFails {
            validateCharacterChoices(
                item,
                obj("""{"style":["a"]}"""),
                base,
                items,
                HandbookMetadata(),
            )
        }
        validateCharacterChoices(item, obj("""{"style":["b"]}"""), base, items, HandbookMetadata())
    }

    @Test
    fun changingAChoiceClearsTransitiveDependenciesWithoutTouchingAnotherSource() {
        val item =
            CatalogueItem(
                7,
                7,
                "Дар",
                data =
                    obj(
                        """{"choices":[{"key":"class","options":[{"value":"11"},{"value":"12"}]},{"key":"spell","depends_on_choice":"class","options":[{"value":"8"}]},{"key":"detail","depends_on_choice":"spell","options":[{"value":"x"}]}]}"""
                    ),
            )
        val draft =
            CreationDraft(
                choices =
                    mapOf(
                        "7|class" to listOf("11"),
                        "7|spell" to listOf("8"),
                        "7|detail" to listOf("x"),
                        "origin:7|class" to listOf("11"),
                    )
            )
        val context =
            CreationContext(draft, listOf(item), HandbookMetadata(), JsonObject(emptyMap()))
        val changed = pickCreationChoice(context, "7|class", "12", 1)
        assertEquals(listOf("12"), changed.choices["7|class"])
        assertTrue(changed.choices["7|spell"].orEmpty().isEmpty())
        assertTrue(changed.choices["7|detail"].orEmpty().isEmpty())
        assertEquals(draft.choices["origin:7|class"], changed.choices["origin:7|class"])
    }

    @Test
    fun dynamicClassChangeRejectsStaleSpellAndRequiresCompletingItsDependency() {
        val item =
            CatalogueItem(
                7,
                7,
                "Дар",
                data =
                    obj(
                        """{"choices":[{"key":"class","count":1,"options":[{"value":"11","label":"Первый"},{"value":"12","label":"Второй"}]},{"key":"spell","source":"item","from_item_type_id":5,"count":1,"depends_on_choice":"class","item_filter":"lvl=0","item_filter_from_choice":{"choice_key":"class","path":"classes"}}]}"""
                    ),
            )
        val spell = CatalogueItem(8, 5, "Заговор", data = obj("""{"lvl":0,"classes":[11]}"""))
        val base = sheet("{}")
        val items = mapOf(7L to item, 8L to spell)
        validateCharacterChoices(
            item,
            obj("""{"class":["11"],"spell":[8]}"""),
            base,
            items,
            HandbookMetadata(),
        )
        assertFails {
            validateCharacterChoices(
                item,
                obj("""{"class":["12"],"spell":[8]}"""),
                base,
                items,
                HandbookMetadata(),
            )
        }
        assertFails {
            validateCharacterChoices(
                item,
                obj("""{"spell":[8]}"""),
                base,
                items,
                HandbookMetadata(),
            )
        }
    }

    @Test
    fun retainedExpertisePickCanBeSavedButANewDuplicateTakeIsRejected() {
        val item =
            CatalogueItem(
                7,
                7,
                "Мастерство",
                data =
                    obj(
                        """{"repeatable":true,"choices":[{"key":"skill","source":"suggest_union","count":1,"suggest_sources":[{"suggest_id":15,"prefix":"skill"}],"requires_proficiency":true,"exclude_rank":2,"unique_across_takes":true}],"derived_effects":[{"kind":"skill_proficiency","rank":2,"choice_key":"skill","choice_value_prefix":"skill","target_from_choice":true}]}"""
                    ),
            )
        val before = obj("""{"id":7,"uid":"first","choices":{"skill":["skill:2"]}}""")
        val base =
            sheet(
                """{"DEX":{"skills":{"2":{"up":1}}},"abilities_feats":[{"id":7,"uid":"first","choices":{"skill":["skill:2"]}}]}"""
            )
        val meta = HandbookMetadata(suggests = mapOf("15" to listOf(Suggest(2, 15, "Акробатика"))))
        validateCharacterChoices(
            item,
            before["choices"].objectValue(),
            base,
            mapOf(7L to item),
            meta,
            before,
        )
        assertFails {
            validateCharacterChoices(
                item,
                before["choices"].objectValue(),
                base,
                mapOf(7L to item),
                meta,
            )
        }
    }
}
