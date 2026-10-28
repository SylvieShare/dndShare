package ru.dndshare.client.ui.character

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import ru.dndshare.client.ui.designsystem.WebPalette

/** Native marks avoid font-dependent checkbox/cross/asterisk glyphs. */
@Composable
internal fun VtmDamageMark(kind: String) {
    val label =
        when (kind) {
            "bashing" -> "Поверхностный урон"
            "lethal" -> "Летальный урон"
            "aggravated" -> "Аггравированный урон"
            else -> "Без урона"
        }
    Canvas(Modifier.size(24.dp).semantics { contentDescription = label }) {
        val stroke = 2.dp.toPx()
        drawRoundRect(
            WebPalette.BorderStrong,
            cornerRadius = CornerRadius(3.dp.toPx()),
            style = Stroke(stroke),
        )
        val low = 5.dp.toPx()
        val high = size.width - low
        if (kind in setOf("bashing", "lethal", "aggravated"))
            drawLine(WebPalette.Danger, Offset(low, high), Offset(high, low), stroke)
        if (kind in setOf("lethal", "aggravated"))
            drawLine(WebPalette.Danger, Offset(low, low), Offset(high, high), stroke)
        if (kind == "aggravated") {
            drawLine(
                WebPalette.Danger,
                Offset(size.width / 2, low),
                Offset(size.width / 2, high),
                stroke,
            )
            drawLine(
                WebPalette.Danger,
                Offset(low, size.height / 2),
                Offset(high, size.height / 2),
                stroke,
            )
        }
    }
}
