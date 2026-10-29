package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*

@Composable
fun ShareDashedAction(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    compact: Boolean = false,
    textStyle: TextStyle =
        ShareTypography.context.copy(fontSize = 13.sp, fontWeight = FontWeight.Normal),
) {
    val border = WebPalette.BorderStrong
    Row(
        modifier
            .fillMaxWidth()
            .heightIn(min = if (compact) 28.dp else DesignTokens.Layout.TouchMin)
            .clip(RoundedCornerShape(8.dp))
            .background(WebPalette.Text.copy(alpha = .02f))
            .drawWithCache {
                val stroke = 1.dp.toPx()
                val style =
                    Stroke(
                        stroke,
                        pathEffect =
                            PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx())),
                    )
                onDrawBehind {
                    drawRoundRect(
                        border,
                        Offset(stroke / 2, stroke / 2),
                        Size(size.width - stroke, size.height - stroke),
                        CornerRadius(8.dp.toPx()),
                        style = style,
                    )
                }
            }
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = if (compact) 4.dp else 8.dp),
        horizontalArrangement = if (compact) Arrangement.Start else Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            style = textStyle,
            color = WebPalette.TextMuted,
        )
    }
}
