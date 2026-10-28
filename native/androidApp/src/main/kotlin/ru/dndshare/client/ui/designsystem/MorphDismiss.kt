package ru.dndshare.client.ui.designsystem

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.nestedscroll.*
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Velocity
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/** Drag only after the inner scroller has consumed its motion. No duplicate window or preview. */
@Stable
internal class MorphDismissState(
    private val scope: CoroutineScope,
    val distance: Float,
    val minimumFlick: Float,
    val flingVelocity: Float,
    val canDrag: () -> Boolean,
    val dismiss: () -> Unit,
) {
    var offset by mutableFloatStateOf(0f)
        private set

    private var closing = false
    private var rebound: Job? = null

    fun drag(delta: Float): Float {
        if (!canDrag() || closing) return 0f
        rebound?.cancel()
        rebound = null
        val old = offset
        offset = (offset + delta).coerceIn(0f, distance * 6)
        return offset - old
    }

    fun settle(velocity: Float) {
        if (closing || offset <= 0f) return
        if (
            canDrag() && (offset >= distance || velocity >= flingVelocity && offset >= minimumFlick)
        ) {
            closing = true
            dismiss()
        } else {
            returnToRest()
        }
    }

    fun cancel() {
        if (!closing && offset > 0f) returnToRest()
    }

    fun reopened() {
        closing = false
        if (offset > 0f) {
            returnToRest()
        }
    }

    private fun returnToRest() {
        rebound?.cancel()
        val start = offset
        // Do not suspend the draggable's stop callback: a new gesture can interrupt this job.
        rebound =
            scope.launch(start = CoroutineStart.UNDISPATCHED) {
                Animatable(start).animateTo(0f, spring(dampingRatio = 1f, stiffness = 500f)) {
                    offset = value
                }
            }
    }

    val connection =
        object : NestedScrollConnection {
            override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset =
                if (source == NestedScrollSource.UserInput && offset > 0f)
                    Offset(0f, drag(available.y))
                else Offset.Zero

            override fun onPostScroll(
                consumed: Offset,
                available: Offset,
                source: NestedScrollSource,
            ): Offset =
                if (source == NestedScrollSource.UserInput && available.y > 0)
                    Offset(0f, drag(available.y))
                else Offset.Zero

            override suspend fun onPreFling(available: Velocity): Velocity {
                if (offset <= 0f) return Velocity.Zero
                settle(available.y)
                return Velocity(0f, available.y)
            }
        }
}

@Composable
internal fun MorphDismissHandle(state: MorphDismissState, enabled: Boolean) {
    Box(
        Modifier.width(64.dp)
            .height(DesignTokens.Layout.TouchMin)
            .morphDragSurface(state, enabled)
            .semantics {
                contentDescription = "Потянуть, чтобы закрыть"
                customActions =
                    listOf(
                        CustomAccessibilityAction("Закрыть") {
                            if (enabled) {
                                state.dismiss()
                                true
                            } else false
                        }
                    )
            },
        contentAlignment = Alignment.TopCenter,
    ) {
        Box(
            Modifier.padding(top = 6.dp)
                .size(32.dp, 4.dp)
                .background(WebPalette.TextMuted.copy(alpha = .45f), RoundedCornerShape(2.dp))
        )
    }
}

/** Track in window coordinates: local coordinates move along with this very surface. */
@Composable
internal fun Modifier.morphDragSurface(state: MorphDismissState, enabled: Boolean): Modifier {
    val coordinates = remember { arrayOfNulls<LayoutCoordinates>(1) }
    return onGloballyPositioned { coordinates[0] = it }
        .pointerInput(state, enabled) {
            if (!enabled) return@pointerInput
            val velocity = VelocityTracker()
            var last: Offset? = null
            detectVerticalDragGestures(
                onDragStart = {
                    last = null
                    velocity.resetTracking()
                },
                onDragCancel = { state.cancel() },
                onDragEnd = {
                    last?.let { velocity.addPosition(android.os.SystemClock.uptimeMillis(), it) }
                    state.settle(velocity.calculateVelocity().y)
                },
                onVerticalDrag = { change, initialDelta ->
                    val position =
                        coordinates[0]?.takeIf { it.isAttached }?.localToWindow(change.position)
                            ?: return@detectVerticalDragGestures
                    val delta = last?.let { position.y - it.y } ?: initialDelta
                    last = position
                    velocity.addPosition(change.uptimeMillis, position)
                    if (state.drag(delta) != 0f) change.consume()
                },
            )
        }
}
