package ru.dndshare.client.ui.designsystem.richtext

import android.widget.EditText
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue

internal class RichInputBuffer(initial: String) {
    var view: EditText? = null
    var objects = mutableMapOf<String, RichObject>()
    var applying = false
    var dirty = false
    var sent = initial
    var change: (String) -> Unit = {}
    var revision by mutableIntStateOf(0)
        private set

    private val history = RichUndoHistory(initial)
    private var typingQueued = false
    private var boundaryQueued = false
    private val publish = Runnable { flush() }

    fun cancelPending() {
        view?.removeCallbacks(publish)
    }

    fun requestFlush(breakGroup: Boolean = false) {
        val input = view ?: return
        val changed = !dirty
        dirty = true
        typingQueued = true
        boundaryQueued = boundaryQueued || breakGroup
        input.removeCallbacks(publish)
        input.postDelayed(publish, 250)
        if (changed) revision++
    }

    val canUndo
        get() = dirty || history.canUndo

    val canRedo
        get() = !dirty && history.canRedo

    fun beforeEdit() {
        if (dirty) return
        val input = view ?: return
        history.updateSelection(
            input.selectionStart.coerceAtLeast(0),
            input.selectionEnd.coerceAtLeast(0),
        )
    }

    fun flush() {
        val input = view ?: return
        input.removeCallbacks(publish)
        if (!dirty) return
        val typing = typingQueued
        val breakGroup = boundaryQueued
        typingQueued = false
        boundaryQueued = false
        val html = RichHtmlCodec.encode(input.editableText, objects)
        dirty = false
        revision++
        if (html != sent) {
            sent = html
            history.record(
                RichHistoryEntry(html, input.selectionStart, input.selectionEnd),
                typing,
                breakGroup = breakGroup,
            )
            change(html)
        }
    }

    fun edit(action: (EditText) -> Unit) {
        val input = view ?: return
        flush()
        beforeEdit()
        applying = true
        try {
            action(input)
        } finally {
            applying = false
        }
        dirty = true
        flush()
    }

    fun undo(): Boolean {
        flush()
        return restore(history.undo())
    }

    fun redo(): Boolean {
        flush()
        return restore(history.redo())
    }

    private fun restore(entry: RichHistoryEntry?): Boolean {
        val input = view ?: return false
        entry ?: return false
        val decoded =
            RichHtmlCodec.decode(
                entry.html,
                input.currentTextColor,
                input.highlightColor,
                input.textSize,
            )
        applying = true
        try {
            objects = decoded.objects
            input.setText(decoded.text)
            input.setSelection(
                entry.start.coerceIn(0, input.length()),
                entry.end.coerceIn(0, input.length()),
            )
        } finally {
            applying = false
        }
        sent = entry.html
        dirty = false
        revision++
        change(entry.html)
        return true
    }
}
