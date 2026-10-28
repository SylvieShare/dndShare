package ru.dndshare.client.ui.character

import kotlin.test.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.MemorySheetForms
import ru.dndshare.client.SheetStateServer
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

@OptIn(ExperimentalCoroutinesApi::class)
class SheetRollExecutorTest {
    private fun obj(value: String) = WireJson.parseToJsonElement(value).jsonObject

    @Test
    fun anOrdinaryRepeatCannotInheritThePreviousPaidRerollsCost() = runTest {
        val cache = MemorySheetForms()
        val api = SheetStateServer()
        api.sheet =
            CharacterSheet(
                "DND5",
                1,
                obj(
                    """{"values":{"lvl":{"level":5},"weapon":[{"uid":"one","item_id":1,"magic_item_id":2,"params":{"magic":{"remaining":1}}}]}}"""
                ),
                1,
            )
        val item =
            CatalogueItem(
                2,
                19,
                "Удача",
                data =
                    obj(
                        """{"attunement":"none","max_use":1,"confirmed_uses":[{"key":"luck","title":"Удача","confirm_label":"Подтвердить","resource_cost":1}],"roll_triggers":[{"event":"any","action":"reroll","use_key":"luck"}]}"""
                    ),
            )
        val sheets = CharacterSheetRepository(api, cache, 1, backgroundScope)
        sheets.refresh("hero")
        val executor =
            SheetRollExecutor(
                "hero",
                1,
                sheets,
                cache,
                null,
                { SheetContentState(items = mapOf(2L to item)) },
                { null },
                { null },
            )
        val first = executor.execute(SheetRollRequest("Проверка"), "auto")
        assertFailsWith<IllegalArgumentException> {
            executor.execute(
                first.request,
                first.result.mode,
                first.copy(sessionUuid = "old-session"),
                first.actions().single().key,
            )
        }
        val paid =
            executor.execute(first.request, first.result.mode, first, first.actions().single().key)
        assertTrue(paid.reroll)
        assertNull(paid.request.eventData["resourceSpent"])
        assertNull(paid.request.eventData["resourceChanges"])
        assertTrue(paid.actions().isEmpty())
        val again = executor.execute(paid.request, "auto")
        sheets.awaitSaved("hero")
        val events = api.packets.flatMap { it.metadata }.mapNotNull { it["roll"]?.objectValue() }
        assertEquals(1, events.count { it["resourceSpent"] == JsonPrimitive(1) })
        assertNull(events.last()["resourceSpent"])
        assertNull(again.request.eventData["resourceSpent"])
        val current = requireNotNull(sheets.local("hero")).displayed
        assertEquals(
            JsonPrimitive(0),
            inventoryInstances(current)
                .single()
                .first["params"]
                .objectValue()["magic"]
                .objectValue()["remaining"],
        )
    }
}
