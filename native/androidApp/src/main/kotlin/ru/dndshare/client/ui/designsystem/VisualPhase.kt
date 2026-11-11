package ru.dndshare.client.ui.designsystem

import android.animation.ValueAnimator
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.*

/** Draw-phase clock: hidden/background/reduced-motion visuals do not produce animation frames. */
@Composable
internal fun rememberVisualPhase(enabled: Boolean, seconds: Float, maxFps: Int = 60, pauseOnFocusLoss: Boolean = true): State<Float> {
    val phase = remember { mutableFloatStateOf(0f) }
    val clock = remember { VisualPhaseClock() }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val active = enabled && (!pauseOnFocusLoss || LocalWindowInfo.current.isWindowFocused)
    LaunchedEffect(active, lifecycle, seconds, maxFps) {
        clock.pause()
        if (!active) return@LaunchedEffect
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            var published = 0L
            val frameStep = 1_000_000_000L / maxFps.coerceIn(1, 60)
            try {
                while (isActive) {
                    if (!ValueAnimator.areAnimatorsEnabled()) {
                        clock.pause()
                        delay(250)
                    } else
                        withFrameNanos { now ->
                            val elapsed = clock.frame(now)
                            if (maxFps >= 60 || now - published >= frameStep) {
                                phase.floatValue = elapsed / 1_000_000_000f / seconds
                                published = now
                            }
                        }
                }
            } finally { clock.pause() }
        }
    }
    return phase
}
