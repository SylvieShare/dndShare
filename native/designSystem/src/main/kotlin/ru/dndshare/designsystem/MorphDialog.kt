package ru.dndshare.designsystem

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.material3.LocalContentColor
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.*
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import kotlin.math.roundToInt
import kotlinx.coroutines.flow.first

/** Moves the original subtree into the native modal; only its width reflows each frame. */
@Composable
fun ShareMorphDialog(state: ShareMorphState, visibleKey: String?, label: String, dismissEnabled: Boolean,
    onDismiss: () -> Unit, editor: @Composable () -> Unit) {
    var readyKey by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(visibleKey) {
        if (visibleKey != null) {
            if (state.activeKey != visibleKey) {
                if (state.activeKey == null) state.fraction.snapTo(0f)
                readyKey = null
                state.activeKey = visibleKey
                // Native window creation must not consume the opening animation.
                snapshotFlow { readyKey }.first { it == visibleKey }
                repeat(2) { withFrameNanos { } }
            }
            state.fraction.animateTo(1f, tween(DesignTokens.Motion.MorphOpen, easing = CubicBezierEasing(.2f, 0f, 0f, 1f)))
        } else {
            state.fraction.animateTo(0f, tween(DesignTokens.Motion.MorphClose, easing = CubicBezierEasing(.2f, 0f, 0f, 1f)))
            state.finish()
        }
    }
    DisposableEffect(state) { onDispose { state.finish() } }
    val key = state.activeKey ?: return
    val entry = state.entry(key)
    Dialog(onDismissRequest = { if (dismissEnabled) onDismiss() }, properties = DialogProperties(
        usePlatformDefaultWidth = false, decorFitsSystemWindows = false, dismissOnClickOutside = false)) {
        val focus = LocalFocusManager.current
        val keyboard = LocalSoftwareKeyboardController.current
        LaunchedEffect(visibleKey) {
            if (visibleKey == null) { focus.clearFocus(); keyboard?.hide() }
        }
        val window = (LocalView.current.parent as? DialogWindowProvider)?.window
        DisposableEffect(window) {
            window?.setDimAmount(0f)
            window?.setWindowAnimations(0)
            onDispose { }
        }
        CompositionLocalProvider(LocalContentColor provides WebPalette.Text) {
            Box(Modifier.fillMaxSize()) {
                val interaction = remember { MutableInteractionSource() }
                Box(Modifier.matchParentSize().drawBehind { drawRect(Color.Black.copy(alpha = .48f * state.progress)) }
                    .clickable(interactionSource = interaction, indication = null, enabled = dismissEnabled, onClick = onDismiss)
                    .clearAndSetSemantics { })
                val density = LocalDensity.current
                val direction = LocalLayoutDirection.current
                val safe = WindowInsets.safeDrawing
                var offset by remember { mutableStateOf(Offset(safe.getLeft(density, direction).toFloat(), safe.getTop(density).toFloat())) }
                Layout(content = {
                    Box(Modifier.drawBehind { drawRect(WebPalette.Surface) }.pointerInput(Unit) { detectTapGestures { } })
                    Box(Modifier.background(WebPalette.Background))
                    Box(if (entry?.scrollPreview != false) Modifier.verticalScroll(rememberScrollState()) else Modifier) {
                        entry?.movable?.invoke(state.expanded)
                    }
                    Box(Modifier.verticalScroll(rememberScrollState())) { editor() }
                }, modifier = Modifier.fillMaxSize().windowInsetsPadding(safe).imePadding().clipToBounds()
                    .onGloballyPositioned { offset = it.positionInWindow(); readyKey = key }.semantics { paneTitle = label }) { children, constraints ->
                    val plan = morphPlan(Size(constraints.maxWidth.toFloat(), constraints.maxHeight.toFloat()),
                        entry?.bounds?.translate(-offset), entry?.lastVisibleBounds?.translate(-offset), density.density)
                    val p = state.progress
                    val previewWidth = lerp(plan.source.width, plan.previewWidth, p).roundToInt().coerceAtLeast(1)
                    val previewHeight = lerp(plan.source.height, plan.previewLimit, p).roundToInt().coerceAtLeast(1)
                    val preview = children[2].measure(Constraints.fixedWidth(previewWidth).copy(maxHeight = previewHeight))
                    val editorLimit = if (plan.stacked) (plan.maximumHeight - plan.previewLimit).coerceAtLeast(1f) else plan.maximumHeight
                    // Fixed constraints let Compose reuse this measurement throughout the animation.
                    val form = children[3].measure(Constraints.fixedWidth(plan.editorWidth.roundToInt().coerceAtLeast(1))
                        .copy(maxHeight = editorLimit.roundToInt().coerceAtLeast(1)))
                    val frame = plan.frame(p, form.height.toFloat())
                    val backing = children[0].measure(Constraints.fixed(frame.width.roundToInt().coerceAtLeast(1), frame.height.roundToInt().coerceAtLeast(1)))
                    val editorX = if (plan.stacked) 0 else previewWidth
                    val editorY = if (plan.stacked) preview.height else 0
                    val formBackdropWidth = (frame.width.roundToInt() - editorX).coerceAtLeast(0)
                    val formBackdropHeight = (frame.height.roundToInt() - editorY).coerceAtLeast(0)
                    val formBackdrop = children[1].measure(Constraints.fixed(formBackdropWidth.coerceAtLeast(1), formBackdropHeight.coerceAtLeast(1)))
                    val radius = if (plan.stacked) 0f else DesignTokens.Radius.Morph.toPx() * p
                    layout(constraints.maxWidth, constraints.maxHeight) {
                        backing.placeWithLayer(frame.left.roundToInt(), frame.top.roundToInt()) {
                            shape = MorphClip(Rect(0f, 0f, frame.width, frame.height), radius)
                            clip = true
                            shadowElevation = 20.dp.toPx() * p
                        }
                        if (formBackdropWidth > 0 && formBackdropHeight > 0) {
                            formBackdrop.placeWithLayer(frame.left.roundToInt() + editorX, frame.top.roundToInt() + editorY) {
                                shape = MorphClip(Rect(-editorX.toFloat(), -editorY.toFloat(), frame.width - editorX, frame.height - editorY), radius)
                                clip = true
                            }
                        }
                        preview.placeWithLayer(frame.left.roundToInt(), frame.top.roundToInt()) {
                            shape = MorphClip(Rect(0f, 0f, frame.width, frame.height), radius)
                            clip = true
                        }
                        form.placeWithLayer(frame.left.roundToInt() + editorX, frame.top.roundToInt() + editorY) {
                            shape = MorphClip(Rect(-editorX.toFloat(), -editorY.toFloat(), frame.width - editorX, frame.height - editorY), radius)
                            clip = true
                            alpha = ((state.progress - .25f) / .75f).coerceIn(0f, 1f)
                        }
                    }
                }
            }
        }
    }
}

private class MorphClip(private val bounds: Rect, private val radius: Float) : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density) =
        Outline.Rounded(RoundRect(bounds, CornerRadius(radius)))
}

private fun lerp(start: Float, end: Float, progress: Float) = start + (end - start) * progress
