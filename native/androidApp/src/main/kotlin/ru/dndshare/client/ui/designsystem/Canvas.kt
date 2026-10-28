package ru.dndshare.client.ui.designsystem

import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.PointMode
import androidx.compose.ui.graphics.StrokeCap

/** Same quiet dotted canvas as share-ui/styles/canvas.css. */
fun Modifier.shareCanvas(): Modifier = drawWithCache {
    val step = DesignTokens.Canvas.Step.toPx()
    val radius = DesignTokens.Canvas.Radius.toPx()
    val color =
        WebPalette.BorderStrong.copy(
            alpha = WebPalette.BorderStrong.alpha * DesignTokens.Canvas.Opacity
        )
    val width = size.width
    val height = size.height
    val points = buildList {
        var x = step / 2
        while (x < width) {
            var y = step / 2
            while (y < height) {
                add(Offset(x, y))
                y += step
            }
            x += step
        }
    }
    onDrawBehind {
        drawRect(WebPalette.Background)
        drawPoints(points, PointMode.Points, color, strokeWidth = radius * 2, cap = StrokeCap.Round)
    }
}
