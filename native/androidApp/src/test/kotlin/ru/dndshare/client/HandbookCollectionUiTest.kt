package ru.dndshare.client

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.*
import org.junit.Test
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.*

class HandbookCollectionUiTest {
    @Test fun spellRowMatchesWebIdentityAndUsesOnlyAnIconImage() {
        val type = ItemType(5, "Заклинания", iconImageUrl = "https://test/type.webp")
        val item = CatalogueItem(1, 5, "Огонёк", "fire_bolt", Json.parseToJsonElement(
            """{"lvl":0,"concentration":true,"ritual":true,"time":{"kind":"action"},"range":{"kind":"touch"}}"""
        ).jsonObject, coverImageUrl = "https://test/cover.webp")
        val row = handbookRow(item, type, HandbookMetadata())
        assertEquals("—", row.metric)
        assertEquals("Fire Bolt", row.alternate)
        assertEquals("Действие · Касание", row.subtitle)
        assertEquals(listOf("К", "Р"), row.badges)
        assertEquals(type.iconImageUrl, row.imageUrl)
        assertNotEquals(item.coverImageUrl, row.imageUrl)
    }
    @Test fun creatureUsesCurrentCombatFieldsAndItemIconTakesPrecedence() {
        val type = ItemType(6, "Бестиарий", iconImageUrl = "https://test/type.webp")
        val item = CatalogueItem(2, 6, "Дракон", data = Json.parseToJsonElement(
            """{"combat":{"cr":"1/2","hp":24}}""").jsonObject, iconImageUrl = "https://test/item.webp")
        val row = handbookRow(item, type, HandbookMetadata())
        assertEquals("1/2", row.metric)
        assertEquals("♥ 24", row.trailing)
        assertEquals(item.iconImageUrl, row.imageUrl)
    }
    @Test fun headingCleanupCannotRemoveANewerScreenRegistration() {
        val heading = HandbookHeadingState()
        val old = Any(); val current = Any(); var clicks = 0
        heading.publish(old, ItemType(5, "Заклинания")) {}
        heading.publish(current, ItemType(6, "Бестиарий")) { clicks++ }
        heading.clear(old)
        assertEquals(6L, heading.type?.id)
        heading.goHome(); assertEquals(1, clicks)
        heading.clear(current); assertNull(heading.type)
    }
    @Test fun wideRecordSelectionKeepsTheListWhilePhoneNavigatesToItsOwnScene() {
        val list = HandbookDestination(true, 5, 0, null)
        val record = list.copy(itemId = 1)
        assertEquals(list.key(LayoutFormat.Wide), record.key(LayoutFormat.Wide))
        assertNotEquals(list.key(LayoutFormat.Phone), record.key(LayoutFormat.Phone))
        assertTrue(record.depth > list.depth)
    }
}
