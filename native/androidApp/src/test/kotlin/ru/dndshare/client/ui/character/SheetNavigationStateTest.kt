package ru.dndshare.client.ui.character

import kotlin.test.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.RichInteractions

class SheetNavigationStateTest {
    @Test
    fun articleHistoryRetainsTheCastingSourceForTheSameSpellInTwoBooks() {
        val sheet =
            CharacterSheet(
                "DND5",
                1,
                WireJson.parseToJsonElement(
                        """{"values":{"lvl":{"level":4},"INT":{"value":{"base":16}},"CHA":{"value":{"base":12}},"spells":{"tabs":[{"key":"wizard","casting_ability":4,"spells":[{"id":5,"key":"arcane"}]},{"key":"bard","casting_ability":6,"spells":[{"id":5,"key":"song"}]}]}}}"""
                    )
                    .jsonObject,
                1,
            )
        val items = mapOf(5L to CatalogueItem(5, 5, "Заклинание"))
        val first = SheetNavigationState().pushItem(5, "arcane").pushItem(10).popItem()
        val second = first.pushItem(5, "song")
        val restored = decodeSheetNavigation(WireJson.encodeToString(second))
        fun modifier(nav: SheetNavigationState): Double? {
            val readout =
                spellReadout(sheet, nav.itemStack.last().spellKey!!, items, HandbookMetadata())
            return spellRichInteractions(RichInteractions(), readout, 1).variables["casting_mod"]
        }
        assertEquals(1.0, modifier(restored))
        assertEquals(3.0, modifier(restored.popItem()))
        assertEquals(1, restored.version)
    }

    @Test
    fun legacySavedNavigationIsUpgradedWithoutDiscardingTheOpenArticle() {
        val old =
            decodeSheetNavigation(
                """{"sectionName":"Spells","itemStack":[5,10],"itemSpellKeys":["arcane",""]}"""
            )
        assertEquals("Spells", old.sectionName)
        assertEquals(
            listOf(SheetItemDestination(5, "arcane"), SheetItemDestination(10)),
            old.itemStack,
        )
        assertEquals(old, decodeSheetNavigation(WireJson.encodeToString(old)))
        assertEquals(SheetNavigationState(), decodeSheetNavigation("invalid"))
    }
}
