package ru.dndshare.client.ui.designsystem

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp

/**
 * Native liquid indicator matching the web sphere; only changes animate, so idle costs no frames.
 */
@Composable
fun ShareResourceOrb(
    charged: Boolean,
    label: String,
    modifier: Modifier = Modifier,
    color: Color = WebPalette.Accent,
    enabled: Boolean = true,
    onClick: (() -> Unit)? = null,
    compact: Boolean = false,
) {
    val fill by animateFloatAsState(if (charged) 1f else 0f, tween(550), label = "Resource liquid")
    Canvas(
        modifier
            .size(if (compact) 36.dp else 48.dp)
            .semantics {
                contentDescription = label
                stateDescription = if (charged) "Доступна" else "Потрачена"
            }
            .then(
                if (onClick != null)
                    Modifier.clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                else Modifier
            )
    ) {
        val rim = 1.5.dp.toPx()
        val radius = (30.dp.toPx() - rim) / 2
        val center = Offset(size.width / 2, size.height / 2)
        drawCircle(Color(0xFF0D0E15), radius, center)
        drawCircle(lerp(Color(0xFF3A3D4D), color, .5f * fill), radius, center, style = Stroke(rim))
        val inner = radius - rim
        val clipping =
            Path().apply {
                addOval(
                    androidx.compose.ui.geometry.Rect(
                        center - Offset(inner, inner),
                        Size(inner * 2, inner * 2),
                    )
                )
            }
        clipPath(clipping) {
            val top = center.y + inner - inner * 2 * fill
            drawRect(color, Offset(center.x - inner, top), Size(inner * 2, inner * 2 * fill))
            if (fill > 0f && fill < 1f)
                drawLine(
                    Color.White.copy(alpha = .5f),
                    Offset(center.x - inner, top),
                    Offset(center.x + inner, top),
                    1.dp.toPx(),
                )
        }
        drawCircle(
            Color.White.copy(alpha = .45f),
            inner * .26f,
            Offset(center.x - inner * .3f, center.y - inner * .35f),
        )
    }
}
