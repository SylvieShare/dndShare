package ru.dndshare.client.ui.designsystem

import android.os.Build
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.layer.*
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.unit.*

internal val LocalChromeManaged = staticCompositionLocalOf { false }

/** A single content subtree, sampled only behind the chrome. Foreground controls stay sharp. */
@Composable
fun ShareChromeLayout(
    modifier: Modifier = Modifier,
    blurEnabled: Boolean = true,
    header: @Composable () -> Unit,
    subheader: @Composable () -> Unit = {},
    content: @Composable (PaddingValues) -> Unit,
) {
    val supported = Build.VERSION.SDK_INT >= 31 && blurEnabled
    val source = if (supported) rememberGraphicsLayer() else null
    val blurred = if (supported) rememberGraphicsLayer() else null
    SubcomposeLayout(modifier.fillMaxSize()) { constraints ->
        val chromeBounds = constraints.copy(minHeight = 0)
        val main =
            subcompose("header") {
                    CompositionLocalProvider(LocalChromeManaged provides true) { header() }
                }
                .map { it.measure(chromeBounds) }
        val mainHeight = main.maxOfOrNull { it.height } ?: 0
        val lower =
            subcompose("subheader") {
                    CompositionLocalProvider(LocalChromeManaged provides true) { subheader() }
                }
                .map { it.measure(chromeBounds) }
        val lowerHeight = lower.maxOfOrNull { it.height } ?: 0
        val top = (mainHeight + lowerHeight).toDp()
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
                        content(PaddingValues(top = top))
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
                        val fadeStart = (mainHeight / size.height).coerceIn(0f, 1f)
                        val tint = WebPalette.Background.copy(alpha = DesignTokens.Chrome.Tint)
                        if (source != null && blurred != null) {
                            blurred.renderEffect =
                                BlurEffect(
                                    DesignTokens.Chrome.Blur.toPx(),
                                    DesignTokens.Chrome.Blur.toPx(),
                                    TileMode.Clamp,
                                )
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
                                ),
                                blendMode = BlendMode.DstIn,
                            )
                        } else {
                            drawRect(
                                Brush.verticalGradient(
                                    0f to tint,
                                    fadeStart to tint,
                                    1f to Color.Transparent,
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
            lower.forEach { it.placeRelative(0, mainHeight) }
        }
    }
}
