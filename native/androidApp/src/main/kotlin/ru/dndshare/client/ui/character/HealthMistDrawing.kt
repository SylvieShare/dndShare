package ru.dndshare.client.ui.character

import androidx.compose.ui.geometry.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.*
import kotlin.math.*

/** Same normalized glass, cloud layers and liquid edge as web healthMistDrawing.js. */
internal fun DrawScope.drawHealthMist(fill: Float, temporary: Float, echo: Float, phase: Float, color: Color, temporaryColor: Color) {
    val unit = size.height / 16f
    if (echo > fill) drawRect(color.copy(alpha = .15f), size = Size(size.width * echo, size.height))
    fun segment(left: Float, right: Float, ink: Color, offset: Float) {
        if (right <= left) return
        val start = size.width * left
        val end = size.width * right
        val extent = end - start
        val path = Path().apply {
            moveTo(start, 0f)
            for (step in 0..12) {
                val y = size.height * step / 12f
                val wave = sin(step / 12f * 2 * PI + phase * 1.3 + offset).toFloat() * sin(step / 12f * PI).toFloat()
                val edge = if (right >= .999f) end else (end + wave * min(4 * unit, extent * .1f)).coerceIn(start, size.width)
                lineTo(edge, y)
            }
            lineTo(start, size.height)
            close()
        }
        clipPath(path) {
            drawRect(Brush.verticalGradient(0f to ink.copy(alpha = .66f), .45f to ink.copy(alpha = .30f), 1f to ink.copy(alpha = .64f)),
                Offset(start, 0f), Size(extent + 5 * unit, size.height))
            for (i in 0..5) {
                val x = start + ((i * .193f + phase / (2 * PI.toFloat()) * .17f + offset) % 1f) * extent
                val y = size.height * (.5f + sin(phase * .63f + i * 2.1f) * .28f)
                val radius = size.height * (1.5f + i % 3 * .35f)
                withTransform({ translate(x, y); scale(1f, .42f, Offset.Zero) }) {
                    drawCircle(Brush.radialGradient(0f to ink.copy(alpha = .42f), .45f to ink.copy(alpha = .19f), 1f to Color.Transparent,
                        center = Offset.Zero, radius = radius), radius, Offset.Zero)
                }
            }
            drawRect(Color.White.copy(alpha = .15f), Offset(start, unit), Size(extent, unit))
            for (i in 0..3) {
                val travel = (phase / (2 * PI.toFloat()) * .27f + i * .237f) % 1f
                drawCircle(Color.White.copy(alpha = sin(travel * PI).toFloat().coerceAtLeast(0f) * .32f), .7f * unit,
                    Offset(start + extent * ((i * .281f + .1f) % 1f), size.height * (1 - travel)))
            }
        }
    }
    segment(0f, fill, color, 0f)
    segment(fill, min(1f, fill + temporary), temporaryColor, .47f)
}
