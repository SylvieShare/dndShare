package ru.dndshare.designsystem

import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.unit.dp

/** Same quiet dotted canvas as share-ui/styles/canvas.css. */
fun Modifier.shareCanvas(): Modifier = drawWithCache {
    val step = 24.dp.toPx()
    val radius = 1.dp.toPx()
    val color = WebPalette.BorderStrong.copy(alpha = .16f * .42f)
    onDrawBehind {
        drawRect(WebPalette.Background)
        var x = step / 2
        while (x < size.width) {
            var y = step / 2
            while (y < size.height) {
                drawCircle(color, radius, Offset(x, y))
                y += step
            }
            x += step
        }
    }
}
