package ru.dndshare.client.ui.designsystem.richtext

import kotlin.test.*
import org.junit.Test

class RichUndoHistoryTest {
    @Test
    fun typingGroupsButFormattingAndWordBoundariesStaySeparate() {
        val h = RichUndoHistory("original")
        h.record(RichHistoryEntry("o", 1, 1), true, 0)
        h.record(RichHistoryEntry("on", 2, 2), true, 200)
        h.record(RichHistoryEntry("one ", 4, 4), true, 400, true)
        h.record(RichHistoryEntry("<b>one</b> ", 4, 4), false, 500)
        assertEquals("one ", h.undo()?.html)
        assertEquals("on", h.undo()?.html)
        assertEquals("original", h.undo()?.html)
        assertNull(h.undo())
        assertEquals("on", h.redo()?.html)
        assertEquals("one ", h.redo()?.html)
        assertEquals("<b>one</b> ", h.redo()?.html)
        assertNull(h.redo())
    }

    @Test
    fun caretRestoresAndNewEditDropsOnlyTheRedoBranch() {
        val h = RichUndoHistory("<p>Меч</p>")
        h.updateSelection(2, 3)
        h.record(RichHistoryEntry("<p>Магический меч</p>", 7, 7), at = 0)
        assertEquals(RichHistoryEntry("<p>Меч</p>", 2, 3), h.undo())
        h.record(RichHistoryEntry("<p>Щит</p>", 3, 3), at = 100)
        assertFalse(h.canRedo)
        assertEquals("<p>Меч</p>", h.undo()?.html)
    }

    @Test
    fun memoryAndEntryLimitsRetainTheNewestUndoSteps() {
        val h = RichUndoHistory("a", maxEntries = 3, maxCharacters = 12)
        for (i in 1..9) h.record(RichHistoryEntry("entry$i", 0, 0), at = i.toLong())
        assertEquals("entry8", h.undo()?.html)
        assertNull(h.undo())
        assertEquals("entry9", h.redo()?.html)
    }
}
