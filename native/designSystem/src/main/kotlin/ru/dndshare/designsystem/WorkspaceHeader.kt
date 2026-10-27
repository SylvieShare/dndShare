package ru.dndshare.designsystem

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Shared workspace chrome; screen actions and navigation belong to the caller. */
@Composable
fun ShareWorkspaceHeader(
    modifier: Modifier = Modifier,
    contentInset: Dp = DesignTokens.Spacing.Page,
    maxContentWidth: Dp = DesignTokens.Layout.ContentMax,
    content: @Composable RowScope.() -> Unit,
) {
    Surface(modifier.fillMaxWidth(), color = WebPalette.Surface, shadowElevation = 4.dp) {
        Box(Modifier.fillMaxWidth().drawWithContent {
            drawContent()
            val stroke = DesignTokens.Layout.Border.toPx()
            val y = size.height - stroke / 2
            drawLine(WebPalette.BorderStrong, Offset(0f, y), Offset(size.width, y), strokeWidth = stroke)
        }, contentAlignment = Alignment.Center) {
            Row(Modifier.widthIn(max = maxContentWidth).fillMaxWidth()
                .heightIn(min = DesignTokens.Layout.Header)
                .padding(horizontal = contentInset, vertical = DesignTokens.Spacing.Xs),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(DesignTokens.Spacing.Small), content = content)
        }
    }
}
