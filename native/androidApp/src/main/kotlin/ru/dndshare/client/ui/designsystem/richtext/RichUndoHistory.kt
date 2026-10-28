package ru.dndshare.client.ui.designsystem.richtext

internal data class RichHistoryEntry(val html: String, val start: Int, val end: Int)

/** Bounded edit history stores portable HTML and caret state, never native Views or drawables. */
internal class RichUndoHistory(
    initial: String,
    private val maxEntries: Int = 40,
    private val maxCharacters: Int = 1_000_000,
) {
    private val entries = mutableListOf(RichHistoryEntry(initial, 0, 0))
    private var index = 0
    private var groupAt = Long.MIN_VALUE
    val canUndo
        get() = index > 0

    val canRedo
        get() = index < entries.lastIndex

    fun record(
        value: RichHistoryEntry,
        typing: Boolean = false,
        at: Long = System.nanoTime() / 1_000_000,
        breakGroup: Boolean = false,
    ) {
        if (entries[index].html == value.html) return
        val merging =
            typing &&
                !breakGroup &&
                canUndo &&
                !canRedo &&
                groupAt != Long.MIN_VALUE &&
                at - groupAt in 0..600
        while (entries.lastIndex > index) entries.removeAt(entries.lastIndex)
        if (merging) entries[index] = value
        else {
            entries.add(value)
            index++
        }
        groupAt = if (typing && !breakGroup) at else Long.MIN_VALUE
        while (
            entries.size > 1 &&
                (entries.size > maxEntries || entries.sumOf { it.html.length } > maxCharacters)
        ) {
            entries.removeAt(0)
            index--
        }
    }

    fun updateSelection(start: Int, end: Int) {
        entries[index] = entries[index].copy(start = start, end = end)
    }

    fun undo(): RichHistoryEntry? {
        groupAt = Long.MIN_VALUE
        return if (canUndo) entries[--index] else null
    }

    fun redo(): RichHistoryEntry? {
        groupAt = Long.MIN_VALUE
        return if (canRedo) entries[++index] else null
    }
}
