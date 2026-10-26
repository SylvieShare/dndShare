package ru.dndshare.client.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.unit.dp

enum class Glyph { Book, Characters, Refresh, Back, Exit, Search, Chevron }

@Composable
fun AppGlyph(glyph: Glyph, modifier: Modifier = Modifier) {
    val color = LocalContentColor.current
    Canvas(modifier.size(24.dp)) {
        withTransform({ scale(size.width / 24f, size.height / 24f, androidx.compose.ui.geometry.Offset.Zero) }) {
            val path = Path().apply {
                when (glyph) {
                    Glyph.Book -> {
                        moveTo(12f, 5f); cubicTo(8f, 2f, 4f, 3f, 2f, 4f); lineTo(2f, 19f)
                        cubicTo(5f, 18f, 9f, 18f, 12f, 21f); cubicTo(15f, 18f, 19f, 18f, 22f, 19f)
                        lineTo(22f, 4f); cubicTo(19f, 3f, 15f, 2f, 12f, 5f); lineTo(12f, 21f)
                    }
                    Glyph.Characters -> {
                        addOval(androidx.compose.ui.geometry.Rect(8f, 3f, 16f, 11f))
                        moveTo(4f, 21f); lineTo(4f, 19f); cubicTo(4f, 12f, 20f, 12f, 20f, 19f); lineTo(20f, 21f)
                        moveTo(2f, 7f); cubicTo(1f, 12f, 6f, 12f, 6f, 9f)
                        moveTo(22f, 7f); cubicTo(23f, 12f, 18f, 12f, 18f, 9f)
                    }
                    Glyph.Refresh -> {
                        moveTo(20f, 9f); cubicTo(17f, 0f, 3f, 2f, 3f, 12f)
                        cubicTo(3f, 23f, 19f, 24f, 21f, 14f)
                        moveTo(20f, 3f); lineTo(20f, 9f); lineTo(14f, 9f)
                    }
                    Glyph.Back -> { moveTo(20f, 12f); lineTo(4f, 12f); moveTo(10f, 5f); lineTo(3f, 12f); lineTo(10f, 19f) }
                    Glyph.Exit -> {
                        moveTo(10f, 3f); lineTo(4f, 3f); lineTo(4f, 21f); lineTo(10f, 21f)
                        moveTo(9f, 12f); lineTo(22f, 12f); moveTo(17f, 7f); lineTo(22f, 12f); lineTo(17f, 17f)
                    }
                    Glyph.Search -> { addOval(androidx.compose.ui.geometry.Rect(3f, 3f, 16f, 16f)); moveTo(15f, 15f); lineTo(21f, 21f) }
                    Glyph.Chevron -> { moveTo(8f, 5f); lineTo(15f, 12f); lineTo(8f, 19f) }
                }
            }
            drawPath(path, color, style = Stroke(1.7f, cap = StrokeCap.Round, join = StrokeJoin.Round))
        }
    }
}
