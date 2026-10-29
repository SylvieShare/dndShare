package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.*
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.*
import kotlinx.coroutines.*

private val dieBubbles =
    listOf(
        floatArrayOf(17f, 49f, 2.8f, 0f, 3.4f),
        floatArrayOf(31f, 51f, 2.2f, 1.05f, 3.9f),
        floatArrayOf(42f, 48f, 2.5f, 2.1f, 3.1f),
    )

/** Exact web SVG layers; small filtered textures are cached off-thread, bubbles stay vector. */
@Composable
fun ShareDie(
    sides: Int,
    value: String,
    color: Color = WebPalette.Accent,
    modifier: Modifier = Modifier,
    size: Dp = 42.dp,
) {
    val shapeId =
        if (sides == 100) 10 else if (sides in shareDieShapes) sides else if (sides <= 6) 6 else 20
    val shape = shareDieShapes.getValue(shapeId)
    val density = LocalDensity.current
    val scaled = size * density.fontScale.coerceAtLeast(1f)
    val pixels = with(density) { scaled.roundToPx() }.coerceAtLeast(1)
    val key =
        remember(shapeId, value, color, pixels) {
            DieRasterKey(shapeId, value, color.toArgb(), pixels)
        }
    val raster by
        produceState(DieRasterCache.get(key), key) {
            this.value = withContext(Dispatchers.Default) { DieRasterCache.render(key) }
        }
    val path = remember(shape.path) { PathParser().parsePathString(shape.path).toPath() }
    var visible by remember { mutableStateOf(false) }
    val phase = rememberVisualPhase(visible && raster != null, 3.4f)
    Canvas(
        modifier
            .size(scaled)
            .onGloballyPositioned { visible = !it.boundsInWindow().isEmpty }
            .semantics { contentDescription = "к$sides: $value" }
    ) {
        val image = raster
        if (image == null) {
            drawRoundRect(
                WebPalette.Raised,
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(8.dp.toPx()),
            )
            return@Canvas
        }
        drawImage(image.glass, dstSize = IntSize(this.size.width.toInt(), this.size.height.toInt()))
        val factor = this.size.width / 56
        withTransform({ scale(factor, factor, pivot = Offset.Zero) }) {
            clipPath(path) {
                val elapsed = phase.value * 3.4f
                dieBubbles.forEach { b ->
                    if (elapsed >= b[3]) {
                        val p = ((elapsed - b[3]) / b[4]) % 1f
                        val a =
                            when {
                                p < .18f -> p / .18f * .78f
                                p < .68f -> .78f - (p - .18f)
                                else -> .48f * (1f - (p - .68f) / .32f)
                            }.coerceIn(0f, 1f)
                        val center = Offset(b[0], b[1] - (56 * .56f) * p)
                        drawCircle(
                            Color.White.copy(alpha = .55f * a),
                            b[2] * (.6f + .4f * p),
                            center,
                        )
                        drawCircle(
                            Color.White.copy(alpha = .38f * a),
                            b[2] * (.6f + .4f * p),
                            center,
                            style = Stroke(.65f),
                        )
                    }
                }
            }
        }
        drawImage(
            image.foreground,
            dstSize = IntSize(this.size.width.toInt(), this.size.height.toInt()),
        )
    }
}
