package ru.dndshare.client.ui.character

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun VtmRatingRow(
    label: String,
    value: Int,
    maximum: Int,
    enabled: Boolean,
    change: () -> Unit,
) {
    val count = maximum.coerceIn(1, 20)
    val score = value.coerceIn(0, count)
    val columns = minOf(10, count)
    val rows = (count + columns - 1) / columns
    Row(
        Modifier.fillMaxWidth()
            .heightIn(min = 48.dp)
            .clickable(enabled = enabled, onClick = change)
            .semantics { stateDescription = "$score из $count" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            label,
            Modifier.weight(1f),
            style = ShareTypography.group.copy(fontSize = 13.sp, fontWeight = FontWeight.Normal),
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        Canvas(Modifier.width((columns * 18 - 4).dp).height((rows * 18 - 4).dp)) {
            val step = 18.dp.toPx()
            for (index in 0 until count) {
                val center =
                    Offset(
                        7.dp.toPx() + (index % columns) * step,
                        7.dp.toPx() + (index / columns) * step,
                    )
                if (index < score) drawCircle(WebPalette.Warning, 7.dp.toPx(), center)
                else
                    drawCircle(
                        WebPalette.BorderStrong,
                        6.dp.toPx(),
                        center,
                        style = Stroke(2.dp.toPx()),
                    )
            }
        }
    }
}
