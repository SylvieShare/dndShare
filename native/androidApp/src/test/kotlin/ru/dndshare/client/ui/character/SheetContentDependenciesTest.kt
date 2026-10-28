package ru.dndshare.client.ui.character

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class SheetContentDependenciesTest {
    private fun obj(text: String) = WireJson.parseToJsonElement(text).jsonObject

    @Test
    fun dependenciesIncludeChosenItemsAndPruneCyclesWhenOwnersChange() {
        fun sheet(id: Int) =
            CharacterSheet(
                "DND5",
                1,
                obj("""{"values":{"abilities_class":[{"id":10,"choices":{"pet":[$id]}}]}}"""),
                1,
            )
        val owner =
            CatalogueItem(
                10,
                4,
                "Способность",
                data =
                    obj(
                        """{"choices":[{"key":"pet","source":"item","from_item_type_id":6}],"status_effects":[{"effect":100}],"granted_spells":[{"spell":30}],"item_creation":[{"outputs":[{"item":40}]}]}"""
                    ),
            )
        val cycle = CatalogueItem(100, 15, "Эффект", data = obj("""{"on_end_effect":10}"""))
        val items =
            listOf(
                    owner,
                    cycle,
                    CatalogueItem(20, 6, "Первый"),
                    CatalogueItem(999, 4, "Не используется"),
                )
                .associateBy { it.id }
        assertEquals(
            listOf(20L, 30L, 40L, 100L),
            sheetContentDependencies(sheet(20), items, listOf(10L)),
        )
        assertEquals(
            listOf(21L, 30L, 40L, 100L),
            sheetContentDependencies(sheet(21), items, listOf(10L)),
        )
        assertTrue(sheetContentDependencies(sheet(21), items, listOf(50L)).isEmpty())
    }
}
