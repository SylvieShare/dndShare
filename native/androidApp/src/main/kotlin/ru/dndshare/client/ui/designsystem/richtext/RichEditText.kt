package ru.dndshare.client.ui.designsystem.richtext

import android.widget.EditText

internal class RichEditText(context: android.content.Context) : EditText(context) {
    var undo: () -> Boolean = { false }
    var redo: () -> Boolean = { false }

    override fun performClick(): Boolean = super.performClick()

    override fun onKeyShortcut(keyCode: Int, event: android.view.KeyEvent): Boolean {
        if (event.isCtrlPressed && keyCode == android.view.KeyEvent.KEYCODE_Z)
            return if (event.isShiftPressed) redo() else undo()
        if (event.isCtrlPressed && keyCode == android.view.KeyEvent.KEYCODE_Y) return redo()
        return super.onKeyShortcut(keyCode, event)
    }

    override fun onTextContextMenuItem(id: Int): Boolean =
        when (id) {
            android.R.id.undo -> undo()
            android.R.id.redo -> redo()
            else -> super.onTextContextMenuItem(id)
        }
}
