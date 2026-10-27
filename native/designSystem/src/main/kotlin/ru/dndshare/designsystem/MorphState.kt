package ru.dndshare.designsystem

import android.os.Build
import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.BlurEffect
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.constrainWidth
import androidx.compose.ui.unit.constrainHeight
import androidx.compose.ui.unit.dp

@Stable
class ShareMorphPresentation internal constructor(val expanded: Boolean, val progress: () -> Float)

internal class MorphContent(content: @Composable (ShareMorphPresentation) -> Unit) {
    var renderer by mutableStateOf(content)
    val movable = movableContentOf<ShareMorphPresentation> { renderer(it) }
    var placed by mutableStateOf(false)
    var bounds by mutableStateOf<Rect?>(null)
    var lastVisibleBounds by mutableStateOf<Rect?>(null)
    var sourceSize by mutableStateOf(IntSize.Zero)
    var scrollPreview by mutableStateOf(true)
    val bindings = mutableSetOf<Any>()
}

@Stable
class ShareMorphState {
    private val contents = mutableMapOf<String, MorphContent>()
    internal val fraction = Animatable(0f)
    internal var activeKey by mutableStateOf<String?>(null)
    internal var revision by mutableIntStateOf(0)
    val progress get() = if (activeKey == null) 0f else fraction.value
    internal val original = ShareMorphPresentation(false) { 0f }
    internal val expanded = ShareMorphPresentation(true) { progress }

    internal fun entry(key: String, content: @Composable (ShareMorphPresentation) -> Unit) = contents.getOrPut(key) { MorphContent(content) }
    internal fun entry(key: String): MorphContent? { revision; return contents[key]?.takeIf { it.placed } }
    internal fun release(key: String, entry: MorphContent, token: Any) {
        entry.bindings.remove(token)
        if (entry.bindings.isEmpty() && activeKey != key && contents[key] === entry) contents.remove(key)
    }
    internal fun finish() {
        activeKey = null
        contents.entries.removeAll { it.value.bindings.isEmpty() }
    }
}

val LocalShareMorphState = staticCompositionLocalOf<ShareMorphState?> { null }

@Composable
fun rememberShareMorphState() = remember { ShareMorphState() }

/** One movable subtree: its measured placeholder remains in the document while editing. */
@Composable
fun ShareMorphSource(key: String, modifier: Modifier = Modifier, scrollPreview: Boolean = true, content: @Composable (ShareMorphPresentation) -> Unit) {
    val state = LocalShareMorphState.current
    if (state == null) { Box(modifier) { content(ShareMorphPresentation(false) { 0f }) }; return }
    val entry = remember(state, key) { state.entry(key, content) }
    val token = remember { Any() }
    DisposableEffect(entry) {
        entry.bindings.add(token)
        onDispose { state.release(key, entry, token) }
    }
    SideEffect { entry.renderer = content; entry.scrollPreview = scrollPreview }
    val moving = state.activeKey == key && entry.placed
    val coordinates = modifier.onGloballyPositioned {
        if (!it.isAttached) return@onGloballyPositioned
        val raw = it.boundsInWindow(clipBounds = false)
        val visible = it.boundsInWindow()
        entry.bounds = raw
        if (visible.width > 0 && visible.height > 0) entry.lastVisibleBounds = raw
        if (!moving) entry.sourceSize = it.size
        if (!entry.placed && it.size.width > 0 && it.size.height > 0) { entry.placed = true; state.revision++ }
    }
    if (moving) Layout({}, coordinates.fillMaxWidth().clearAndSetSemantics { }) { _, constraints ->
        layout(constraints.constrainWidth(entry.sourceSize.width), constraints.constrainHeight(entry.sourceSize.height)) { }
    } else Box(coordinates) { entry.movable(state.original) }
}

fun Modifier.shareMorphBackground(state: ShareMorphState): Modifier = graphicsLayer {
    renderEffect = if (Build.VERSION.SDK_INT >= 31 && state.progress > 0f) {
        val radius = 8.dp.toPx() * state.progress
        BlurEffect(radius, radius, TileMode.Clamp)
    } else null
}
