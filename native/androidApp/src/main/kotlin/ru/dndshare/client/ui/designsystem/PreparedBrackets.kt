package ru.dndshare.client.ui.designsystem

import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp

/** Open side brackets mark prepared state, matching PreparedSpellBrackets in the web client. */
fun Modifier.sharePreparedBrackets(color: Color): Modifier = drawWithContent {
    drawContent()
    val left = 10.dp.toPx()
    val top = 7.dp.toPx()
    val width = (size.width - left * 2).coerceAtLeast(1f)
    val height = (size.height - top * 2).coerceAtLeast(1f)
    val edge = 13.dp.toPx().coerceAtMost(size.width / 3)
    val radius = 11.dp.toPx().coerceAtMost(size.height / 2)
    val line = 1.dp.toPx()
    fun path(mirror: Boolean) =
        Path().apply {
            fun x(value: Float) = if (mirror) left + width - value else left + value
            moveTo(x(edge), top + line / 2)
            lineTo(x(radius), top + line / 2)
            quadraticTo(x(line / 2), top + line / 2, x(line / 2), top + radius)
            lineTo(x(line / 2), top + height - radius)
            quadraticTo(
                x(line / 2),
                top + height - line / 2,
                x(radius),
                top + height - line / 2,
            )
            lineTo(x(edge), top + height - line / 2)
        }
    drawPath(path(false), color, style = Stroke(line))
    drawPath(path(true), color, style = Stroke(line))
}
