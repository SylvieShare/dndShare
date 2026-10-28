package ru.dndshare.client.ui.character

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class ReorderFormsTest {
    private fun obj(text: String) = WireJson.parseToJsonElement(text).jsonObject

    private fun sheet(values: String) =
        CharacterSheet("DND5", 1, buildJsonObject { put("values", obj(values)) }, 1)

    private fun reversed(
        target: String,
        base: CharacterSheet,
        items: Map<Long, CatalogueItem> = emptyMap(),
    ): CharacterSheet {
        val form = initialForm(target, base, items)
        val input =
            JsonObject(
                form.input + ("entries" to JsonArray(form.input["entries"].arrayValue().reversed()))
            )
        return base.copy(
            data = applySheetPatches(base.data, formPatches(form.copy(input = input), base, items))
        )
    }

    @Test
    fun spaceOrderingIncludesEquippedItemsWithoutChangingTheirMechanicsSource() {
        val base =
            sheet(
                """{"items":{"equipped":[{"uid":"worn","item_id":12,"params":{"custom":1}}],"sections":[{"id":"bag","name":"Сумка","items":[{"uid":"one","item_id":1,"count":3}],"slots":{"one":0,"worn":1}}]}}"""
            )
        val next = reversed("reorder:inventory|bag", base)
        val before = base.values["items"].objectValue()
        val after = next.values["items"].objectValue()
        assertEquals(before["equipped"], after["equipped"])
        val section = after["sections"].arrayValue().single().objectValue()
        assertEquals(0, section["slots"].objectValue()["worn"].number())
        assertEquals(1, section["slots"].objectValue()["one"].number())
        assertEquals(
            before["sections"].arrayValue().single().objectValue()["items"],
            section["items"],
        )
    }

    @Test
    fun inventoryReorderingChangesPhysicalSlotsAndKeepsCountsAndOverrides() {
        val base =
            sheet(
                """{"items":{"equipped":[],"sections":[{"id":"bag","name":"Сумка","items":[{"uid":"one","item_id":1,"count":3,"override":{"name":"Мой"}},{"uid":"two","item_id":2,"count":1}],"slots":{"one":5,"two":1}}]}}"""
            )
        val next = reversed("reorder:inventory|bag", base)
        val before =
            base.values["items"].objectValue()["sections"].arrayValue().single().objectValue()
        val after =
            next.values["items"].objectValue()["sections"].arrayValue().single().objectValue()
        assertEquals(before["items"], after["items"])
        assertEquals(1, after["slots"].objectValue()["one"].number())
        assertEquals(5, after["slots"].objectValue()["two"].number())
    }

    @Test
    fun learnedSpellsReorderWithoutTouchingGrantsOrPreparationAndRejectDuplicates() {
        val base =
            sheet(
                """{"spells":{"schema_version":2,"tabs":[{"key":"class:11","name":"Книга","spells":[{"key":"a","id":1,"prepared":true},{"key":"b","id":2}]}],"grants":[{"key":"external","id":3}]}}"""
            )
        val next = reversed("reorder:spells|class:11", base)
        val before = base.values["spells"].objectValue()
        val after = next.values["spells"].objectValue()
        assertEquals(before["grants"], after["grants"])
        val rows = after["tabs"].arrayValue().single().objectValue()["spells"].arrayValue()
        assertEquals(listOf("b", "a"), rows.map { it.objectValue().text("key") })
        assertEquals(JsonPrimitive(true), rows.last().objectValue()["prepared"])
        val form = initialForm("reorder:spells|class:11", base)
        val one = form.input["entries"].arrayValue().first()
        assertFails {
            formPatches(
                form.copy(input = buildJsonObject { put("entries", JsonArray(listOf(one, one))) }),
                base,
                emptyMap(),
            )
        }
    }

    @Test
    fun actionOrderIncludesDerivedActionsAndKeepsOtherGroupsOrder() {
        val base =
            sheet(
                """{"abilities_class":[{"id":10}],"actions":[{"uid":"one","title":"Первое","action_type":"action"},{"uid":"two","title":"Второе","action_type":"action"},{"uid":"bonus","title":"Бонус","action_type":"bonus_action"}],"action_order":["manual:bonus"]}"""
            )
        val item =
            CatalogueItem(
                10,
                4,
                "Умение",
                data =
                    obj(
                        """{"feature_actions":[{"key":"three","title":"Третье","action_type":"action"}]}"""
                    ),
            )
        val items = mapOf(10L to item)
        val before = featureActions(base, items).filter { it.type == "action" }.map { it.key }
        val next = reversed("reorder:actions|action", base, items)
        assertEquals(
            before.reversed(),
            featureActions(next, items).filter { it.type == "action" }.map { it.key },
        )
        assertEquals(
            "manual:bonus",
            next.values["action_order"].arrayValue().first().jsonPrimitive.content,
        )
    }
}
