package ru.dndshare.client.ui.designsystem

import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.*
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.*
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

/** Product-owned preview chrome; the transparent platform host only supplies focus and Back. */
@Composable
fun SharePreviewWindow(
    label: String,
    close: () -> Unit,
    back: (() -> Unit)? = null,
    navigationKey: Any? = label,
    content: @Composable () -> Unit,
) {
    val progress = remember { Animatable(0f) }
    val scope = rememberCoroutineScope()
    var closing by remember { mutableStateOf(false) }
    val latestClose by rememberUpdatedState(close)
    val latestBack by rememberUpdatedState(back)
    val focus = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current
    fun requestClose() {
        if (closing) return
        if (latestBack != null) {
            latestClose()
            return
        }
        closing = true
        scope.launch {
            progress.animateTo(0f, tween(DesignTokens.Motion.Exit))
            latestClose()
        }
    }
    ShareFullscreenDialog(
        onDismissRequest = ::requestClose,
        dimAmount = 0f,
        blurBehind = DesignTokens.Layout.ItemViewWindowBlur,
    ) {
        val density = LocalDensity.current
        BoxWithConstraints(
            Modifier.fillMaxSize().drawBehind {
                drawRect(WebPalette.Scrim.copy(alpha = WebPalette.Scrim.alpha * progress.value))
            }
        ) {
            val compact = maxWidth <= DesignTokens.Layout.ItemViewWindowCompactMax
            val drag =
                remember(density, compact) {
                    MorphDismissState(
                        scope,
                        with(density) { 96.dp.toPx() },
                        with(density) { 12.dp.toPx() },
                        with(density) { 1200.dp.toPx() },
                        { compact && !closing && progress.value >= .99f },
                        ::requestClose,
                    )
                }
            LaunchedEffect(navigationKey) { drag.reopened() }
            LaunchedEffect(Unit) {
                withFrameNanos {}
                focus.requestFocus()
                keyboard?.hide()
                progress.animateTo(1f, tween(DesignTokens.Motion.Enter))
            }
            Box(
                Modifier.fillMaxSize()
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = ::requestClose,
                    )
                    .semantics { contentDescription = "Закрыть просмотр снаружи" }
            )
            BoxWithConstraints(
                Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing),
                contentAlignment = if (compact) Alignment.BottomCenter else Alignment.Center,
            ) {
                val margin = if (compact) 0.dp else 24.dp
                Surface(
                    Modifier.padding(margin)
                        .widthIn(max = DesignTokens.Layout.ItemViewWindowWidth)
                        .fillMaxWidth()
                        .heightIn(max = maxHeight * if (compact) .8f else .85f)
                        .animateContentSize(tween(DesignTokens.Motion.Navigation))
                        .graphicsLayer {
                            alpha = progress.value
                            translationY =
                                (1 - progress.value) *
                                    (if (compact) 48.dp.toPx() else 12.dp.toPx()) + drag.offset
                            scaleX = if (compact) 1f else .98f + .02f * progress.value
                            scaleY = scaleX
                        }
                        .nestedScroll(drag.connection)
                        .focusRequester(focus)
                        .focusable()
                        .focusProperties {
                            onExit = {
                                if (requestedFocusDirection != FocusDirection.Exit)
                                    cancelFocusChange()
                            }
                        }
                        .semantics {
                            dialog()
                            paneTitle = label
                            dismiss {
                                requestClose()
                                true
                            }
                        },
                    shape =
                        if (compact) RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp)
                        else RoundedCornerShape(18.dp),
                    color = WebPalette.Background,
                    shadowElevation = 20.dp,
                ) {
                    Box {
                        content()
                        if (compact)
                            Box(
                                Modifier.align(Alignment.TopCenter)
                                    .width(72.dp)
                                    .height(24.dp)
                                    .morphDragSurface(drag, !closing)
                                    .semantics {
                                        contentDescription = "Потянуть, чтобы закрыть просмотр"
                                    },
                                contentAlignment = Alignment.Center,
                            ) {
                                Box(
                                    Modifier.width(36.dp)
                                        .height(4.dp)
                                        .background(
                                            WebPalette.Text.copy(alpha = .58f),
                                            RoundedCornerShape(2.dp),
                                        )
                                )
                            }
                        Row(Modifier.align(Alignment.TopEnd).padding(6.dp)) {
                            if (back != null)
                                PreviewControl("Назад к предмету", Glyph.Back) {
                                    if (!closing) latestBack?.invoke()
                                }
                            PreviewControl("Закрыть просмотр", Glyph.Close, ::requestClose)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PreviewControl(label: String, glyph: Glyph, action: () -> Unit) {
    Box(Modifier.size(48.dp), contentAlignment = Alignment.Center) {
        Box(
            Modifier.size(34.dp)
                .background(WebPalette.Background.copy(alpha = .8f), RoundedCornerShape(9.dp))
        )
        IconButton(action, Modifier.semantics { contentDescription = label }) {
            AppGlyph(glyph, Modifier.size(18.dp), WebPalette.Text)
        }
    }
}
