package ru.dndshare.client.ui.character

import androidx.compose.foundation.focusable
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.*

/** Bubble after native text fields have handled their own undo/redo. */
@Composable
internal fun Modifier.sheetHistoryKeys(
    enabled: Boolean,
    canUndo: Boolean,
    canRedo: Boolean,
    history: (Boolean) -> Unit,
): Modifier {
    val focus = remember { FocusRequester() }
    LaunchedEffect(enabled) { if (enabled) focus.requestFocus() }
    return onKeyEvent { event ->
            if (
                !enabled ||
                    event.type != KeyEventType.KeyDown ||
                    event.isAltPressed ||
                    !event.isCtrlPressed && !event.isMetaPressed
            )
                return@onKeyEvent false
            val forward =
                when (event.key) {
                    Key.Z -> event.isShiftPressed
                    Key.Y -> true
                    else -> return@onKeyEvent false
                }
            if (if (forward) !canRedo else !canUndo) return@onKeyEvent false
            history(forward)
            true
        }
        .focusRequester(focus)
        .focusable(enabled)
}
