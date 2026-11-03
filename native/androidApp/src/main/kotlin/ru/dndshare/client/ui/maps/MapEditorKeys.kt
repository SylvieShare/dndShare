package ru.dndshare.client.ui.maps

import android.view.KeyEvent
import ru.dndshare.client.maps.*

/** Only the focused canvas receives shortcuts; editing a text field retains native editing keys. */
internal fun MapEditorWorkspace.key(event: KeyEvent): Boolean {
    if (event.action != KeyEvent.ACTION_DOWN) return false
    val control = event.isCtrlPressed || event.isMetaPressed
    if (event.keyCode == KeyEvent.KEYCODE_ESCAPE) {
        back()
        return true
    }
    if (!editable) return false
    when {
        control && event.keyCode == KeyEvent.KEYCODE_Z -> {
            if (event.isShiftPressed) controller.redo() else controller.undo()
        }
        control && event.keyCode == KeyEvent.KEYCODE_Y -> controller.redo()
        control && event.keyCode == KeyEvent.KEYCODE_C -> selection.copy()
        control && event.keyCode == KeyEvent.KEYCODE_V -> selection.paste()
        control && event.keyCode == KeyEvent.KEYCODE_A ->
            controller.ui { state ->
                state.copy(
                    focus =
                        MapFocus(
                            current.map
                                ?.document
                                ?.let { doc ->
                                    listOf(MapEntityKind.Tile, MapEntityKind.Object).flatMap { kind
                                        ->
                                        doc.rows(kind.collection).map {
                                            MapEntityRef(kind, it.string("id"))
                                        }
                                    }
                                }
                                .orEmpty()
                        ),
                    focusOpen = true,
                )
            }
        event.keyCode == KeyEvent.KEYCODE_DEL || event.keyCode == KeyEvent.KEYCODE_FORWARD_DEL ->
            selection.remove()
        !control && event.keyCode == KeyEvent.KEYCODE_R -> selection.rotate()
        !control && event.keyCode == KeyEvent.KEYCODE_T -> selection.rotate(mirror = true)
        else -> return false
    }
    return true
}
