package ru.dndshare.client

import kotlinx.serialization.json.*
import kotlin.test.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.*

class HandbookPresentationTest {
    @Test fun richParagraphsAndTablesKeepInlineFormattingWithoutSplittingSentences() {
        val blocks = descriptionBlocks("Первое <strong>слово</strong> вместе.<table><tr><th>Название</th></tr><tr><td>Текст</td></tr></table><p>После таблицы</p>")
        assertEquals(3, blocks.size)
        assertEquals("Первое <strong>слово</strong> вместе.", blocks[0].html)
        assertEquals(listOf(listOf("Название"), listOf("Текст")), blocks[1].rows)
        assertTrue(blocks[1].header)
        assertContains(blocks[2].html, "После таблицы")
    }

    @Test fun collectionsKeepHierarchyAndShowEachTypeOnce() {
        val types = listOf(ItemType(101, "Подраздел", parentTypeId = 100), ItemType(100, "Каталог"),
            ItemType(200, "Самостоятельный"), ItemType(3, "Способности"))
        val groups = collectionGroups(types)
        assertEquals(types.map { it.id }.toSet(), groups.flatMap { it.types }.map { it.id }.toSet())
        assertEquals(types.size, groups.sumOf { it.types.size })
        assertTrue(numericGroup("1/8") < numericGroup("1/2"))
        assertTrue(numericGroup("2") < numericGroup("10"))
        val nested = WireJson.parseToJsonElement("""[{"key":"identity","type":"object","fields":[{"key":"cr","type":"text","group":true,"filter":true}]}]""").jsonArray
        assertEquals("identity.cr", filterFields(nested).single().first)
        assertEquals(listOf(100L, 101L), groups.single { it.name == "Каталог" }.types.map { it.id })
    }

    @Test fun schemaFilterValuesAndSpellSummaryUseReadableLabels() {
        val filter = WireJson.parseToJsonElement("""{"type":"int","filter_values":[0,1,2],"filter_labels":{"0":"Заговор"}}""").jsonObject
        assertEquals("Заговор", filterChoices(filter, HandbookMetadata()).first().second)
        val data = WireJson.parseToJsonElement("""{"lvl":0,"time":{"kind":"bonus_action"},"range":{"kind":"ranged","distance":30},"components":{"v":true,"s":true}}""").jsonObject
        val stats = itemStats(ItemType(5, "Заклинания"), CatalogueItem(1, 5, "Свет", data = data), HandbookMetadata())
        assertEquals("Заговор", stats.single { it.label == "Уровень" }.value)
        assertEquals("Бонусное действие", stats.single { it.label == "Время" }.value)
        assertEquals("30 фт.", stats.single { it.label == "Дистанция" }.value)
        assertEquals("В · С", stats.single { it.label == "Компоненты" }.value)
        val money = WireJson.parseToJsonElement("""{"value":150,"suggest_id":9}""").jsonObject
        val moneyField = WireJson.parseToJsonElement("""{"type":"int_by_suggest"}""").jsonObject
        assertEquals("150 зм", readableValue(money, moneyField, HandbookMetadata(suggests = mapOf("1" to listOf(Suggest(9, 1, "зм"))))))
    }
}
