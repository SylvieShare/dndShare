package ru.dndshare.client.ui.character

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class CharacterFeatureChangesTest {
    private fun obj(text: String) = WireJson.parseToJsonElement(text).jsonObject

    private fun sheet(values: String) =
        CharacterSheet("DND5", 1, buildJsonObject { put("values", obj(values)) }, 1)

    private fun changed(sheet: CharacterSheet, patches: List<SheetPatch>) =
        sheet.copy(data = applySheetPatches(sheet.data, patches))

    @Test
    fun personalityFormOnlyChangesItsSelectedField() {
        val base = sheet("""{"person_traits":"Старое", "person_ideals":"Не менять"}""")
        val form = initialForm("personality:person_traits", base)
        assertEquals(setOf("person_traits"), form.input.keys)
        val next =
            changed(
                base,
                formPatches(
                    form.copy(
                        input =
                            obj(
                                """{"person_traits":"<p>Новые черты</p>","person_ideals":"Чужой ввод"}"""
                            )
                    ),
                    base,
                    emptyMap(),
                ),
            )
        assertEquals("<p>Новые черты</p>", next.values.text("person_traits"))
        assertEquals("Не менять", next.values.text("person_ideals"))
    }

    @Test
    fun timedActionRoundTripKeepsRichDescriptionAndConditions() {
        val base = sheet("""{"actions":[]}""")
        val form = initialForm("action:new", base)
        val data =
            obj(
                """{"uid":"own-action","bucket":"actions","index":-1,"title":"Ритуал","action_type":"timed","time":{"kind":"minutes","value":"10"},"description":"<b>Огонь</b>","requirements":["  Свободная рука  ","","Компоненты"]}"""
            )
        val next = changed(base, formPatches(form.copy(input = data), base, emptyMap()))
        val action = featureActions(next, emptyMap()).single()
        assertEquals("<b>Огонь</b>", action.description)
        assertEquals(10, action.definition["time"].objectValue()["value"].number())
        assertEquals(
            listOf("Свободная рука", "Компоненты"),
            action.definition["requirements"].arrayValue().map { it.jsonPrimitive.content },
        )
        val edit = initialForm("action:0", next)
        val normal =
            changed(
                next,
                formPatches(
                    edit.copy(
                        input = JsonObject(edit.input + ("action_type" to JsonPrimitive("action")))
                    ),
                    next,
                    emptyMap(),
                ),
            )
        assertNull(featureActions(normal, emptyMap()).single().definition["time"])
    }

    @Test
    fun levelingWithARepeatableFeatAssignsAnIndependentBonusSource() {
        val base =
            sheet(
                """{"lvl":{"level":7},"classes":[{"id":11,"level":7}],"hp":{"current":50,"max":{"base":50},"hitDice":[{"die":"d8","total":7,"used":3}]},"STR":{"value":{"base":12,"bonuses":[{"value":1,"sourceFeatKey":"feat:first"}]}},"abilities_feats":[{"id":7,"uid":"first"}],"abilities_class":[]}"""
            )
        val characterClass = CatalogueItem(11, 9, "Класс", data = obj("""{"hit_die":"d8"}"""))
        val feat =
            CatalogueItem(
                7,
                7,
                "Повторяемая черта",
                data = obj("""{"repeatable":true,"asi":[{"ability":1,"bonus":1}]}"""),
            )
        val items = mapOf(11L to characterClass, 7L to feat)
        val next =
            changed(
                base,
                levelAdvancementPatches(
                    LevelAdvancement(
                        base,
                        obj("""{"classId":11,"asiMode":"feat","featId":7}"""),
                        items,
                    )
                ),
            )
        val entries = next.values["abilities_feats"].arrayValue().map { it.objectValue() }
        assertEquals(2, entries.size)
        val uid = entries.single { it.text("uid") != "first" }.text("uid")
        assertTrue(uid.isNotBlank())
        assertEquals(14, next.statScore("STR"))
        val sources =
            next.values["STR"].objectValue()["value"].objectValue()["bonuses"].arrayValue().map {
                it.objectValue().text("sourceFeatKey")
            }
        assertEquals(setOf("feat:first", "feat:$uid"), sources.toSet())
        val remove =
            initialForm("ability:abilities_feats:0", next).let {
                it.copy(input = JsonObject(it.input + ("remove" to JsonPrimitive(true))))
            }
        assertEquals(13, changed(next, formPatches(remove, next, items)).statScore("STR"))
    }

    @Test
    fun directFeatEditingCapsBonusesAndRemovalRestoresOnlyItsOwnBonus() {
        val base =
            sheet(
                """{"lvl":{"level":3},"STR":{"value":{"base":18,"bonuses":[{"title":"Ручной","value":1}]}},"abilities_feats":[]}"""
            )
        val feat =
            CatalogueItem(7, 7, "Дар силы", data = obj("""{"asi":[{"ability":1,"bonus":2}]}"""))
        val items = mapOf(7L to feat)
        val form =
            initialForm("ability:abilities_feats:new", base).let {
                it.copy(input = JsonObject(it.input + ("id" to JsonPrimitive(7))))
            }
        val next = changed(base, formPatches(form, base, items))
        assertEquals(20, next.statScore("STR"))
        val bonuses =
            next.values["STR"].objectValue()["value"].objectValue()["bonuses"].arrayValue()
        assertEquals(1, bonuses.last().objectValue()["value"].number())
        val edit = initialForm("ability:abilities_feats:0", next)
        val edited = changed(next, formPatches(edit, next, items))
        assertEquals(20, edited.statScore("STR"))
        val remove =
            initialForm("ability:abilities_feats:0", edited).let {
                it.copy(input = JsonObject(it.input + ("remove" to JsonPrimitive(true))))
            }
        val removed = changed(edited, formPatches(remove, edited, items))
        assertEquals(19, removed.statScore("STR"))
        assertEquals(
            "Ручной",
            removed.values["STR"]
                .objectValue()["value"]
                .objectValue()["bonuses"]
                .arrayValue()
                .single()
                .objectValue()
                .text("title"),
        )
    }

    @Test
    fun retainedSelectionKeepsUidAndSpentChargesAndReplacementCleansItsStatuses() {
        val base =
            sheet(
                """{"lvl":{"level":3},"classes":[{"id":11,"level":3}],"abilities_class":[{"id":101},{"id":102,"uid":"kept","count":0,"selection_source":101}],"states":[{"uid":"old-status","effect_id":200,"source":{"kind":"ability","item_id":102}}]}"""
            )
        val parent =
            CatalogueItem(
                101,
                4,
                "Набор",
                data =
                    obj(
                        """{"class_ids":[11],"ability_selection":{"counts":[{"level":1,"count":1},{"level":3,"count":2}],"replace_count":1,"replace_levels":[3]}}"""
                    ),
            )
        val old =
            CatalogueItem(
                102,
                4,
                "Первый",
                data = obj("""{"selection_parent_id":101,"max_use":1}"""),
            )
        val extra =
            CatalogueItem(
                103,
                4,
                "Второй",
                data = obj("""{"selection_parent_id":101,"max_use":2}"""),
            )
        val replacement =
            CatalogueItem(
                104,
                4,
                "Третий",
                data =
                    obj(
                        """{"selection_parent_id":101,"selection_requirements":{"abilities":[103]}}"""
                    ),
            )
        val items = listOf(parent, old, extra, replacement).associateBy { it.id }
        val retained = base.values["abilities_class"].arrayValue()[1]
        val added =
            changed(
                base,
                applyAbilitySelection(base, parent, listOf(retained, obj("""{"id":103}""")), items),
            )
        val kept =
            added.values["abilities_class"]
                .arrayValue()
                .single { it.referenceId() == 102L }
                .objectValue()
        assertEquals("kept", kept.text("uid"))
        assertEquals(0, kept["count"].number())
        val extraEntry =
            added.values["abilities_class"].arrayValue().single { it.referenceId() == 103L }
        val replaced =
            changed(
                added,
                applyAbilitySelection(
                    added,
                    parent,
                    listOf(extraEntry, obj("""{"id":104}""")),
                    items,
                ),
            )
        assertTrue(replaced.values["states"].arrayValue().isEmpty())
        assertEquals(
            extraEntry,
            replaced.values["abilities_class"].arrayValue().single { it.referenceId() == 103L },
        )
    }

    @Test
    fun removingOneRepeatableFeatKeepsTheOtherInstancesBonusesAndStatuses() {
        val base =
            sheet(
                """{"lvl":{"level":3},"STR":{"value":{"base":12,"bonuses":[{"value":1,"sourceFeatKey":"feat:first"},{"value":1,"sourceFeatKey":"feat:second"}]}},"abilities_feats":[{"id":7,"uid":"first"},{"id":7,"uid":"second"}],"states":[{"uid":"first-state","effect_id":100,"source":{"kind":"ability","item_id":7,"value_id":"abilities_feats","entry_key":"first"}},{"uid":"second-state","effect_id":101,"source":{"kind":"ability","item_id":7,"value_id":"abilities_feats","entry_key":"second"}},{"uid":"unattributed","effect_id":102,"source":{"kind":"ability","item_id":7}}]}"""
            )
        val item =
            CatalogueItem(
                7,
                7,
                "Повторяемая черта",
                data = obj("""{"repeatable":true,"asi":[{"ability":1,"bonus":1}]}"""),
            )
        val form =
            initialForm("ability:abilities_feats:0", base).let {
                it.copy(input = JsonObject(it.input + ("remove" to JsonPrimitive(true))))
            }
        val result = changed(base, formPatches(form, base, mapOf(7L to item)))
        assertEquals(13, result.statScore("STR"))
        assertEquals(
            "second",
            result.values["abilities_feats"].arrayValue().single().objectValue().text("uid"),
        )
        assertEquals(
            setOf("second-state", "unattributed"),
            result.values["states"].arrayValue().map { it.objectValue().text("uid") }.toSet(),
        )
    }

    @Test
    fun widgetSpendsOnlyOnActivationAndResolvesEndEffects() {
        val base =
            sheet(
                """{"lvl":{"level":3},"abilities_class":[{"id":10,"uid":"rage","count":2}],"states":[{"uid":"concentrating","effect_id":200,"concentration":true}]}"""
            )
        val ability =
            CatalogueItem(
                10,
                4,
                "Ярость",
                data =
                    obj(
                        """{"max_use":3,"scaling":[{"level":1,"value":"+2"}],"status_effects":[{"key":"rage","effect":100,"parameter_bindings":[{"key":"bonus","source":"scaling_value"}]}],"sheet_widgets":[{"key":"rage","kind":"toggle","status_effect_key":"rage"}]}"""
                    ),
            )
        val effect =
            CatalogueItem(
                100,
                15,
                "Ярость",
                data =
                    obj(
                        """{"on_end_effect":{"id":101},"derived_effects":[{"kind":"activity_block","scopes":["concentration"]}]}"""
                    ),
            )
        val end = CatalogueItem(101, 15, "Усталость")
        val concentration = CatalogueItem(200, 15, "Концентрация")
        val items = listOf(ability, effect, end, concentration).associateBy { it.id }
        val active = changed(base, featureWidgetPatches(base, "rage", items))
        assertEquals(1, resourceControls(active, items).single().value)
        val status = active.values["states"].arrayValue().single().objectValue()
        assertEquals(100L, status["effect_id"].referenceId())
        assertEquals(2, status["params"].objectValue()["bonus"].number())
        val inactive = changed(active, featureWidgetPatches(active, "rage", items))
        assertEquals(1, resourceControls(inactive, items).single().value)
        assertEquals(
            101L,
            inactive.values["states"]
                .arrayValue()
                .single()
                .objectValue()["effect_id"]
                .referenceId(),
        )
    }

    @Test
    fun targetActionPaysAndAppliesTogetherAndCounterEffectsHonorBounds() {
        val base =
            sheet(
                """{"lvl":{"level":3},"abilities_class":[{"id":20,"count":2}],"weapon":[{"uid":"blade","item_id":1}],"exhaustion":{"level":5},"states":[]}"""
            )
        val ability =
            CatalogueItem(
                20,
                4,
                "Огонь",
                data =
                    obj(
                        """{"max_use":3,"feature_actions":[{"key":"fire","title":"Пламя","action_type":"bonus_action","uses_resource":true,"resource_cost":1,"target_kind":"weapon","status_effect_code":"flame","menu_effects":[{"key":"tired","kind":"adjust_counter","title":"Усталость","value_id":"exhaustion","counter_key":"level","delta":1,"max":6}]}]}"""
                    ),
            )
        val effect = CatalogueItem(100, 15, "Пылающий клинок", data = obj("""{"code":"flame"}"""))
        val blade = CatalogueItem(1, 1, "Клинок")
        val items = listOf(ability, effect, blade).associateBy { it.id }
        val key = "feature:abilities_class:20:fire"
        val input = obj("""{"operation":"target","targetUid":"blade"}""")
        val active = changed(base, featureActionPatches(base, key, input, items))
        assertEquals(1, resourceControls(active, items).single().value)
        assertEquals(
            "blade",
            active.values["states"]
                .arrayValue()
                .single()
                .objectValue()["params"]
                .objectValue()
                .text("weapon_uid"),
        )
        assertFails { featureActionPatches(active, key, input, items) }
        val consequence = obj("""{"operation":"effect","effectKey":"tired"}""")
        val exhausted = changed(active, featureActionPatches(active, key, consequence, items))
        assertEquals(6, exhausted.values["exhaustion"].objectValue()["level"].number())
        assertFails { featureActionPatches(exhausted, key, consequence, items) }
    }
}
