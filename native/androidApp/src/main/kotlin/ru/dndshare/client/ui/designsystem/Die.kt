package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.*
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*

/** The web's vector geometry rendered by native Canvas, with no idle animation or bitmap cache. */
@Composable
fun ShareDie(
    sides: Int,
    value: String,
    color: Color = WebPalette.Accent,
    modifier: Modifier = Modifier,
    size: Dp = 38.dp,
) {
    val shape = shareDieShapes[if (sides == 100) 10 else sides] ?: shareDieShapes.getValue(20)
    val path = remember(shape.path) { PathParser().parsePathString(shape.path).toPath() }
    val scaled = size * LocalDensity.current.fontScale.coerceAtLeast(1f)
    val font =
        shape.fontSizes[(value.length - 1).coerceIn(0, shape.fontSizes.lastIndex)] * size.value / 56
    Box(
        modifier.size(scaled).semantics { contentDescription = "к" + sides + ": " + value },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.matchParentSize()) {
            val factor = this.size.width / 56
            withTransform({ scale(factor, factor, pivot = Offset.Zero) }) {
                drawPath(path, Color(0xFF0D0E15))
                clipPath(path) {
                    drawRect(
                        color.copy(alpha = .6f),
                        Offset(0f, shape.liquidY),
                        Size(56f, 56f - shape.liquidY),
                    )
                    drawRect(
                        Color.White.copy(alpha = .28f),
                        Offset(0f, shape.shineY),
                        Size(56f, 1.4f),
                    )
                }
                drawPath(path, color.copy(alpha = .85f), style = Stroke(1.25f))
            }
        }
        Text(
            value,
            modifier = Modifier.offset(y = scaled * ((shape.textY - 28) / 56)),
            style =
                ShareTypography.group.copy(fontSize = font.sp, fontWeight = FontWeight.ExtraBold),
            color = Color.White,
        )
    }
}
