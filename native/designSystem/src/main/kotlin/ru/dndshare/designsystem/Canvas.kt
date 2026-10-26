package ru.dndshare.designsystem

import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset

/** Same quiet dotted canvas as share-ui/styles/canvas.css. */
fun Modifier.shareCanvas(): Modifier = drawWithCache {
    val step = DesignTokens.Canvas.Step.toPx()
    val radius = DesignTokens.Canvas.Radius.toPx()
    val color = WebPalette.BorderStrong.copy(alpha = WebPalette.BorderStrong.alpha * DesignTokens.Canvas.Opacity)
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
