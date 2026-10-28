package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.*

class HandbookPresentationTest {
    @Test
    fun suggestLabelsUseTheirOwnTypeWhenIdsOverlap() {
        val metadata =
            HandbookMetadata(
                suggests =
                    mapOf(
                        "16" to listOf(Suggest(1, 16, "Сила")),
                        "7" to listOf(Suggest(1, 7, "Воплощение")),
                        "17" to listOf(Suggest(1, 17, "зм")),
                    )
            )
        assertNull(metadata.suggest(1))
        assertEquals(
            "Воплощение",
            itemStats(
                    ItemType(5, "Заклинания"),
                    CatalogueItem(
                        5,
                        5,
                        "Свет",
                        data = WireJson.parseToJsonElement("""{"schoolId":1}""").jsonObject,
                    ),
                    metadata,
                )
                .single { it.label == "Школа" }
                .value,
        )
        assertEquals(
            "Сила",
            readableValue(
                JsonPrimitive(1),
                WireJson.parseToJsonElement("""{"type":"suggest","suggest_id":16}""").jsonObject,
                metadata,
            ),
        )
        assertEquals(
            "10 зм",
            readableValue(
                WireJson.parseToJsonElement("""{"value":10,"suggest_id":1}"""),
                WireJson.parseToJsonElement("""{"type":"int_by_suggest","suggest_id":17}""")
                    .jsonObject,
                metadata,
            ),
        )
    }

    @Test
    fun richParagraphsAndTablesKeepInlineFormattingWithoutSplittingSentences() {
        val blocks =
            descriptionBlocks(
                "Первое <strong>слово</strong> вместе.<table><tr><th>Название</th></tr><tr><td>Текст</td></tr></table><p>После таблицы</p>"
            )
        assertEquals(3, blocks.size)
        assertEquals("Первое <strong>слово</strong> вместе.", blocks[0].html)
        val table = ru.dndshare.client.ui.designsystem.richtext.RichTableModel(blocks[1].table!!)
        assertEquals(listOf("Название", "Текст"), table.cells.sortedBy { it.row }.map { it.html })
        assertTrue(table.cells.first().header)
        assertContains(blocks[2].html, "После таблицы")
    }

    @Test
    fun collectionsKeepHierarchyAndShowEachTypeOnce() {
        val types =
            listOf(
                ItemType(101, "Подраздел", parentTypeId = 100),
                ItemType(100, "Каталог"),
                ItemType(200, "Самостоятельный"),
                ItemType(3, "Способности"),
            )
        val groups = collectionGroups(types)
        assertEquals(types.map { it.id }.toSet(), groups.flatMap { it.types }.map { it.id }.toSet())
        assertEquals(types.size, groups.sumOf { it.types.size })
        assertTrue(numericGroup("1/8") < numericGroup("1/2"))
        assertTrue(numericGroup("2") < numericGroup("10"))
        val nested =
            WireJson.parseToJsonElement(
                    """[{"key":"identity","type":"object","fields":[{"key":"cr","type":"text","group":true,"filter":true}]}]"""
                )
                .jsonArray
        assertEquals("identity.cr", filterFields(nested).single().first)
        assertEquals(listOf(100L, 101L), groups.single { it.name == "Каталог" }.types.map { it.id })
    }

    @Test
    fun schemaFilterValuesAndSpellSummaryUseReadableLabels() {
        val filter =
            WireJson.parseToJsonElement(
                    """{"type":"int","filter_values":[0,1,2],"filter_labels":{"0":"Заговор"}}"""
                )
                .jsonObject
        assertEquals("Заговор", filterChoices(filter, HandbookMetadata()).first().second)
        val data =
            WireJson.parseToJsonElement(
                    """{"lvl":0,"time":{"kind":"bonus_action"},"range":{"kind":"ranged","distance":30},"components":{"v":true,"s":true}}"""
                )
                .jsonObject
        val stats =
            itemStats(
                ItemType(5, "Заклинания"),
                CatalogueItem(1, 5, "Свет", data = data),
                HandbookMetadata(),
            )
        assertEquals("Заговор", stats.single { it.label == "Уровень" }.value)
        assertEquals("Бонусное действие", stats.single { it.label == "Время" }.value)
        assertEquals("30 фт.", stats.single { it.label == "Дистанция" }.value)
        assertEquals("В · С", stats.single { it.label == "Компоненты" }.value)
        val money = WireJson.parseToJsonElement("""{"value":150,"suggest_id":9}""").jsonObject
        val moneyField = WireJson.parseToJsonElement("""{"type":"int_by_suggest"}""").jsonObject
        assertEquals(
            "150 зм",
            readableValue(
                money,
                moneyField,
                HandbookMetadata(suggests = mapOf("1" to listOf(Suggest(9, 1, "зм")))),
            ),
        )
    }
}
