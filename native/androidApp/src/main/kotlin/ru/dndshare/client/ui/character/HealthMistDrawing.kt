package ru.dndshare.client.ui.character

import androidx.compose.ui.geometry.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.*
import kotlin.math.*
import ru.dndshare.client.ui.designsystem.DesignTokens

/** Same two continuous cloud fields and responsive liquid edge as web healthMistDrawing. */
internal fun DrawScope.drawHealthMist(fill: Float, temporary: Float, echo: Float, phase: Float, color: Color, temporaryColor: Color, activity: Float = 0f) {
    val unit = size.height / (DesignTokens.Layout.SheetHealthHeight.value - 2)
    val tau = 2 * PI.toFloat()
    if (echo > fill) drawRect(color.copy(alpha = .15f), size = Size(size.width * echo, size.height))
    fun segment(left: Float, right: Float, ink: Color, offset: Float) {
        if (right <= left) return
        val start = size.width * left
        val end = size.width * right
        val extent = end - start
        val front = Path()
        val path = Path().apply {
            moveTo(start, 0f)
            for (step in 0..24) {
                val t = step / 24f
                val y = size.height * t
                val wave = (sin(t * tau + phase * .65f + offset) * .7f + sin(t * tau * 2 - phase * .43f) * .3f) * sin(t * PI).toFloat()
                val edge = if (right >= .999f) end else (end + wave * min((1.4f + 3.4f * activity) * unit, extent * .1f)).coerceIn(start, size.width)
                lineTo(edge, y)
                if (step == 0) front.moveTo(edge, y) else front.lineTo(edge, y)
            }
            lineTo(start, size.height)
            close()
        }
        clipPath(path) {
            drawRect(Brush.verticalGradient(0f to ink.copy(alpha = .52f), .5f to ink.copy(alpha = .23f), 1f to ink.copy(alpha = .52f)),
                Offset(start, 0f), Size(extent + 6 * unit, size.height))
            for (layer in 0..1) for (i in 0..4) {
                val speed = if (layer == 1) -.031f else .047f
                val q = i * .217f + phase / tau * speed + offset
                val x = ((q % 1f + 1f) % 1f) * size.width
                val y = size.height * (.48f + sin(phase * (.35f + layer * .13f) + i * 1.83f) * .22f)
                val radius = size.height * (if (layer == 1) 1.1f else 1.85f) * (1 + sin(phase * .23f + i) * .08f)
                for (tile in -1..1) {
                    val px = x + tile * size.width
                    if (px + radius < start || px - radius > end + 6 * unit) continue
                    withTransform({ translate(px, y); scale(1f, if (layer == 1) .5f else .32f, Offset.Zero) }) {
                        val light = if (layer == 1) lerp(ink, Color.White, .25f) else ink
                        drawCircle(Brush.radialGradient(0f to light.copy(alpha = if (layer == 1) .22f else .32f),
                            .5f to ink.copy(alpha = if (layer == 1) .10f else .14f), 1f to Color.Transparent,
                            center = Offset.Zero, radius = radius), radius, Offset.Zero)
                    }
                }
            }
            if (right < .999f) drawPath(front, lerp(ink, Color.White, .55f).copy(alpha = .18f + activity * .3f), style = Stroke(unit))
            drawRect(Color.White.copy(alpha = .12f), Offset(start, unit), Size(extent, unit))
            for (i in 0..3) {
                val travel = (phase / tau * .2f + i * .237f) % 1f
                drawCircle(Color.White.copy(alpha = sin(travel * PI).toFloat().coerceAtLeast(0f) * .25f), .7f * unit,
                    Offset(size.width * ((i * .281f + .1f) % 1f), size.height * (1 - travel)))
            }
        }
    }
    segment(0f, fill, color, 0f)
    segment(fill, min(1f, fill + temporary), temporaryColor, .47f)
}
