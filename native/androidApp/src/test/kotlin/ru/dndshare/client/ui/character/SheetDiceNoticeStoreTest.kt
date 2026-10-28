package ru.dndshare.client.ui.character

import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.character.*

class SheetDiceNoticeStoreTest {
    @Test
    fun pendingAndCompletedResultUseOneIdentityAndDismissedResponsesStayQuiet() {
        val store = SheetDiceNoticeStore()
        val pending =
            store.update(
                SheetRollUiState(request = SheetRollRequest("Атака"), busy = true),
                emptySet(),
                emptySet(),
            )
        val id = pending.recordId
        assertEquals(1, pending.notices.size)
        val finished =
            store.update(
                pending.copy(
                    busy = false,
                    result = SheetRollResult("Атака", "normal", listOf(12), 12, 3, total = 15),
                    completedAt = 100,
                ),
                emptySet(),
                emptySet(),
            )
        assertEquals(id, finished.notices.single().id)
        assertEquals(15, finished.notices.single().result?.total)
        store.dismiss(id)
        assertTrue(store.update(finished, emptySet(), emptySet()).notices.isEmpty())
    }

    @Test
    fun notificationsStayBoundedAndCompletedModesDoNotResetTheLifetime() {
        val store = SheetDiceNoticeStore()
        var ui = SheetRollUiState()
        repeat(8) { index ->
            ui =
                store.update(
                    SheetRollUiState(
                        request = SheetRollRequest("Бросок"),
                        recordId = index.toString(),
                        result = SheetRollResult("Бросок", "normal", listOf(2), 2, 0, total = 2),
                        completedAt = 100 + index.toLong(),
                    ),
                    emptySet(),
                    emptySet(),
                )
        }
        assertEquals(listOf("3", "4", "5", "6", "7"), ui.notices.map { it.id })
        store.mode("7", "advantage")
        ui = store.update(ui.copy(mode = "advantage"), emptySet(), emptySet())
        assertEquals(107L, ui.notices.last().completedAt)
        assertEquals("advantage", ui.notices.last().mode)
    }
}
