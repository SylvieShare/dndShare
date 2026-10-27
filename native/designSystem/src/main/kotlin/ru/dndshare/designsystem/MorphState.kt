package ru.dndshare.designsystem

import android.os.Build
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.BlurEffect
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.unit.dp

@Stable
class ShareMorphState {
    internal val origins = mutableStateMapOf<String, Rect>()
    internal var hiddenKey by mutableStateOf<String?>(null)
    internal var progress by mutableFloatStateOf(0f)
}

val LocalShareMorphState = staticCompositionLocalOf<ShareMorphState?> { null }

@Composable
fun rememberShareMorphState() = remember { ShareMorphState() }

@Composable
fun Modifier.shareMorphSource(key: String): Modifier {
    val state = LocalShareMorphState.current ?: return this
    return onGloballyPositioned { coordinates -> state.origins[key] = coordinates.boundsInWindow() }
        .graphicsLayer { alpha = if (state.hiddenKey == key) 0f else 1f }
}

fun Modifier.shareMorphBackground(state: ShareMorphState): Modifier = graphicsLayer {
    renderEffect = if (Build.VERSION.SDK_INT >= 31 && state.progress > 0f) {
        val radius = 8.dp.toPx() * state.progress
        BlurEffect(radius, radius, TileMode.Clamp)
    } else null
}
