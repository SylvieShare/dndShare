package ru.dndshare.client.ui.designsystem

import android.animation.ValueAnimator
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalWindowInfo
import kotlinx.coroutines.*

/** Draw-phase clock: hidden/background/reduced-motion visuals do not produce animation frames. */
@Composable
internal fun rememberVisualPhase(enabled: Boolean, seconds: Float): State<Float> {
    val phase = remember { mutableFloatStateOf(0f) }
    val focused = LocalWindowInfo.current.isWindowFocused
    LaunchedEffect(enabled, focused, seconds) {
        phase.floatValue = 0f
        if (enabled && focused) {
            var started = 0L
            while (isActive) {
                if (!ValueAnimator.areAnimatorsEnabled()) {
                    phase.floatValue = 0f
                    delay(250)
                } else
                    withFrameNanos { now ->
                        if (started == 0L) started = now
                        phase.floatValue = ((now - started) / 1_000_000_000f) / seconds
                    }
            }
        }
    }
    return phase
}
