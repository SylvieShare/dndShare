package ru.dndshare.designsystem

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.*
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import kotlin.math.roundToInt

/** Opaque bounds morph. Content is remeasured at its final size, never bitmap-scaled. */
@Composable
fun ShareMorphDialog(state: ShareMorphState, visibleKey: String?, label: String, dismissEnabled: Boolean,
    onDismiss: () -> Unit, preview: @Composable () -> Unit, editor: @Composable () -> Unit) {
    val progress = remember { Animatable(0f) }
    var shownKey by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(visibleKey) {
        if (visibleKey != null) {
            shownKey = visibleKey
            state.hiddenKey = visibleKey
            progress.animateTo(1f, tween(DesignTokens.Motion.MorphOpen, easing = CubicBezierEasing(.2f, 0f, 0f, 1f)))
        } else {
            progress.animateTo(0f, tween(DesignTokens.Motion.MorphClose, easing = CubicBezierEasing(.2f, 0f, 0f, 1f)))
            shownKey = null
            state.hiddenKey = null
        }
    }
    LaunchedEffect(progress) { snapshotFlow { progress.value }.collect { state.progress = it } }
    DisposableEffect(state) { onDispose { state.hiddenKey = null; state.progress = 0f } }
    val key = shownKey ?: return
    Dialog(onDismissRequest = { if (dismissEnabled) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false, dismissOnClickOutside = false)) {
        val window = (LocalView.current.parent as? DialogWindowProvider)?.window
        DisposableEffect(window) {
            window?.setDimAmount(0f); window?.setWindowAnimations(0)
            onDispose { }
        }
        Box(Modifier.fillMaxSize()) {
            val interaction = remember { MutableInteractionSource() }
            Box(Modifier.matchParentSize().background(Color.Black.copy(alpha = .48f * progress.value))
                .clickable(interactionSource = interaction, indication = null, enabled = dismissEnabled, onClick = onDismiss).clearAndSetSemantics { })
            BoxWithConstraints(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).imePadding()) {
                val density = LocalDensity.current
                var offset by remember { mutableStateOf(Offset.Zero) }
                val origin = state.origins[key]?.translate(-offset)
                val stacked = maxWidth <= DesignTokens.Layout.MorphStackedMax
                val targetWidth = if (stacked) maxWidth else minOf(maxWidth - DesignTokens.Layout.MorphMargin * 2,
                    (origin?.width?.let { with(density) { it.toDp() } } ?: 280.dp) + DesignTokens.Layout.MorphEditorWidth)
                val previewWidth = if (stacked) targetWidth else minOf(
                    origin?.width?.let { with(density) { it.toDp() } } ?: 280.dp,
                    targetWidth - DesignTokens.Layout.MorphPreviewMin).coerceAtLeast(DesignTokens.Layout.MorphPreviewMin)
                val widthPx = with(density) { targetWidth.roundToPx() }
                val maxHeightPx = with(density) { (if (stacked) maxHeight else maxHeight * .9f).roundToPx() }
                SubcomposeLayout(Modifier.fillMaxSize().clipToBounds().onGloballyPositioned { offset = it.positionInWindow() }) { constraints ->
                    val p = progress.value
                    val panel = subcompose("panel") {
                        Surface(Modifier.semantics { paneTitle = label }.pointerInput(Unit) { detectTapGestures {} }, color = WebPalette.Surface) {
                            if (stacked) Column(Modifier.fillMaxWidth().heightIn(min = with(density) { maxHeightPx.toDp() })
                                .background(WebPalette.Background).verticalScroll(rememberScrollState())) {
                                Box(Modifier.fillMaxWidth().background(WebPalette.Surface)) { preview() }
                                Box(Modifier.fillMaxWidth().animateContentSize(tween(DesignTokens.Motion.Navigation))
                                    .graphicsLayer { alpha = ((progress.value - .25f) / .75f).coerceIn(0f, 1f) }) { editor() }
                            } else Row(Modifier.fillMaxWidth().background(WebPalette.Surface).drawBehind {
                                val x = previewWidth.toPx()
                                drawRect(WebPalette.Background, Offset(x, 0f), Size((size.width - x).coerceAtLeast(0f), size.height))
                                drawLine(WebPalette.Border, Offset(x, 0f), Offset(x, size.height), 1.dp.toPx())
                            }) {
                                Box(Modifier.width(previewWidth).background(WebPalette.Surface).verticalScroll(rememberScrollState())) { preview() }
                                Box(Modifier.weight(1f).animateContentSize(tween(DesignTokens.Motion.Navigation)).verticalScroll(rememberScrollState())
                                    .graphicsLayer { alpha = ((progress.value - .25f) / .75f).coerceIn(0f, 1f) }) { editor() }
                            }
                        }
                    }.single().measure(Constraints(minWidth = widthPx, maxWidth = widthPx, maxHeight = maxHeightPx))
                    val target = Rect((constraints.maxWidth - widthPx) / 2f,
                        if (stacked) 0f else (constraints.maxHeight - panel.height) / 2f,
                        (constraints.maxWidth + widthPx) / 2f,
                        if (stacked) panel.height.toFloat() else (constraints.maxHeight + panel.height) / 2f)
                    val rect = lerp(origin ?: target, target, p)
                    val radius = with(density) { (DesignTokens.Radius.Tile + ((if (stacked) 0.dp else DesignTokens.Radius.Morph) - DesignTokens.Radius.Tile) * p).toPx() }
                    layout(constraints.maxWidth, constraints.maxHeight) {
                        panel.placeWithLayer(rect.left.roundToInt(), rect.top.roundToInt()) {
                            shape = MorphClip(rect.width, rect.height, radius)
                            clip = true
                            shadowElevation = 20.dp.toPx() * p
                        }
                    }
                }
            }
        }
    }
}

private data class MorphClip(val width: Float, val height: Float, val radius: Float) : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline =
        Outline.Rounded(RoundRect(Rect(0f, 0f, width, height), CornerRadius(radius)))
}
