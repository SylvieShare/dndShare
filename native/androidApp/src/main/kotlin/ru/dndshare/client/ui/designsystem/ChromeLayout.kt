package ru.dndshare.client.ui.designsystem

import android.os.Build
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.layer.*
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.unit.*

val LocalChromePadding = staticCompositionLocalOf { PaddingValues() }

val LocalChromeHeaderPadding = staticCompositionLocalOf { PaddingValues() }

internal val LocalChromeManaged = staticCompositionLocalOf { false }

/** A single content subtree, sampled only behind the chrome. Foreground controls stay sharp. */
@Composable
fun ShareChromeLayout(
    modifier: Modifier = Modifier,
    blurEnabled: Boolean = true,
    header: @Composable () -> Unit,
    subheader: @Composable () -> Unit = {},
    footer: (@Composable () -> Unit)? = null,
    collapsibleRow: (@Composable () -> Unit)? = null,
    rowScrollOffset: (Int) -> Int = { 0 },
    content: @Composable (PaddingValues) -> Unit,
) {
    val supported = Build.VERSION.SDK_INT >= 31 && blurEnabled
    val source = if (supported) rememberGraphicsLayer() else null
    val blurred = if (supported) rememberGraphicsLayer() else null
    // Reserve the expanded row once. Animation reads belong to placement and drawing,
    // so scrolling the toolbar does not subcompose or resize the sheet on every frame.
    val radius = with(LocalDensity.current) { DesignTokens.Chrome.Blur.toPx() }
    val blurEffect = remember(blurred, radius) { if (blurred != null) BlurEffect(radius, radius, TileMode.Clamp) else null }
    SideEffect { if (blurred != null && blurred.renderEffect !== blurEffect) blurred.renderEffect = blurEffect }
    val safe = WindowInsets.safeDrawing.exclude(WindowInsets.ime).asPaddingValues()
    val bottom = safe.calculateBottomPadding()
    SubcomposeLayout(modifier.fillMaxSize().imePadding()) { constraints ->
        val chromeBounds = constraints.copy(minHeight = 0)
        val main =
            subcompose("header") {
                    CompositionLocalProvider(LocalChromeManaged provides true) {
                        Box(Modifier.fillMaxWidth().padding(top = safe.calculateTopPadding())) {
                            header()
                        }
                    }
                }
                .map { it.measure(chromeBounds) }
        val mainHeight = main.maxOfOrNull { it.height } ?: 0
        val row = if (collapsibleRow == null) null else subcompose("collapsibleRow") {
            var height by remember { mutableIntStateOf(0) }
            val hidden by remember(rowScrollOffset) { derivedStateOf { height > 0 && rowScrollOffset(height) >= height } }
            Box(Modifier.fillMaxWidth().onSizeChanged { height = it.height }.clipToBounds()
                .then(if (hidden) Modifier.clearAndSetSemantics {} else Modifier)) {
                Box(Modifier.graphicsLayer {
                    val full = size.height.toInt()
                    translationY = -rowScrollOffset(full).coerceIn(0, full).toFloat()
                }) { collapsibleRow() }
            }
        }.single().measure(chromeBounds)
        val rowHeight = row?.height ?: 0
        val lower =
            subcompose("subheader") {
                    CompositionLocalProvider(LocalChromeManaged provides true) { subheader() }
                }
                .map { it.measure(chromeBounds) }
        val lowerHeight = lower.maxOfOrNull { it.height } ?: 0
        val foot =
            subcompose("footer") {
                    if (footer != null)
                        Box(Modifier.fillMaxWidth().padding(bottom = bottom)) { footer() }
                }
                .map { it.measure(chromeBounds) }
        val footerHeight = foot.maxOfOrNull { it.height } ?: 0
        val top = (mainHeight + rowHeight + lowerHeight).toDp()
        val padding =
            PaddingValues(top = top, bottom = if (footer != null) footerHeight.toDp() else bottom)
        val body =
            subcompose("content") {
                    Box(
                        Modifier.fillMaxSize()
                            .then(
                                if (source == null) Modifier
                                else
                                    Modifier.drawWithContent {
                                        source.record { this@drawWithContent.drawContent() }
                                        drawLayer(source)
                                    }
                            )
                    ) {
                        val visiblePadding = remember(padding, rowHeight, rowScrollOffset) {
                            if (rowHeight == 0) padding else object : PaddingValues by padding {
                                override fun calculateTopPadding() = padding.calculateTopPadding() - rowScrollOffset(rowHeight).coerceIn(0, rowHeight).toDp()
                            }
                        }
                        CompositionLocalProvider(
                            LocalChromePadding provides visiblePadding,
                            LocalChromeHeaderPadding provides
                                PaddingValues(top = mainHeight.toDp(), bottom = bottom),
                        ) {
                            content(padding)
                        }
                    }
                }
                .map { it.measure(constraints) }
        val backdrop =
            subcompose("backdrop") {
                    Canvas(
                        Modifier.fillMaxWidth()
                            .height(top + DesignTokens.Chrome.FadeTail)
                            .then(
                                if (source == null) Modifier
                                else
                                    Modifier.graphicsLayer {
                                        compositingStrategy =
                                            androidx.compose.ui.graphics.CompositingStrategy
                                                .Offscreen
                                    }
                            )
                    ) {
                        val fadeEnd = (size.height - rowScrollOffset(rowHeight).coerceIn(0, rowHeight)).coerceAtLeast(1f)
                        val fadeStart = (mainHeight / fadeEnd).coerceIn(0f, 1f)
                        val tint = WebPalette.Background.copy(alpha = DesignTokens.Chrome.Tint)
                        if (source != null && blurred != null) {
                            blurred.record(
                                size = IntSize(size.width.toInt(), size.height.toInt())
                            ) {
                                drawLayer(source)
                            }
                            drawLayer(blurred)
                            drawRect(tint)
                            drawRect(
                                Brush.verticalGradient(
                                    0f to Color.White,
                                    fadeStart to Color.White,
                                    1f to Color.Transparent,
                                    endY = fadeEnd,
                                ),
                                blendMode = BlendMode.DstIn,
                            )
                        } else {
                            drawRect(
                                Brush.verticalGradient(
                                    0f to tint,
                                    fadeStart to tint,
                                    1f to Color.Transparent,
                                    endY = fadeEnd,
                                )
                            )
                        }
                    }
                }
                .map { it.measure(chromeBounds) }
        layout(constraints.maxWidth, constraints.maxHeight) {
            body.forEach { it.placeRelative(0, 0) }
            backdrop.forEach { it.placeRelative(0, 0) }
            main.forEach { it.placeRelative(0, 0) }
            row?.placeRelative(0, mainHeight)
            lower.forEach { it.placeRelativeWithLayer(0, mainHeight + rowHeight - rowScrollOffset(rowHeight).coerceIn(0, rowHeight)) }
            foot.forEach { it.placeRelative(0, constraints.maxHeight - footerHeight) }
        }
    }
}
