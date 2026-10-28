package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.gestures.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.*

/** Taps/scrolling remain native until a held gesture is accepted; accepted drags own moves/up. */
@Composable
fun Modifier.shareLongPressDrag(
    enabled: Boolean,
    onStart: (Offset) -> Boolean,
    onMove: (Offset, Offset) -> Unit,
    onEnd: (cancelled: Boolean) -> Unit,
): Modifier {
    val start by rememberUpdatedState(onStart)
    val move by rememberUpdatedState(onMove)
    val end by rememberUpdatedState(onEnd)
    return pointerInput(enabled) {
        if (enabled)
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Main)
                val held = awaitLongPressOrCancellation(down.id) ?: return@awaitEachGesture
                if (!start(held.position)) return@awaitEachGesture
                var released = false
                try {
                    while (true) {
                        val event = awaitPointerEvent(PointerEventPass.Initial)
                        val pointer = event.changes.firstOrNull { it.id == down.id } ?: break
                        if (!pointer.pressed) {
                            pointer.consume()
                            released = true
                            break
                        }
                        val delta = pointer.positionChange()
                        pointer.consume()
                        move(pointer.position, delta)
                    }
                } finally {
                    end(!released)
                }
            }
    }
}
