package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.background
import androidx.compose.material3.HorizontalDivider
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
    navigation: (@Composable () -> Unit)? = null,
    content: @Composable RowScope.() -> Unit,
) {
    Surface(modifier.fillMaxWidth(), color = WebPalette.Surface, shadowElevation = 4.dp) {
        Column(Modifier.fillMaxWidth().drawWithContent {
            drawContent()
            val stroke = DesignTokens.Layout.Border.toPx()
            val y = size.height - stroke / 2
            drawLine(WebPalette.BorderStrong, Offset(0f, y), Offset(size.width, y), strokeWidth = stroke)
        }, horizontalAlignment = Alignment.CenterHorizontally) {
            Row(Modifier.widthIn(max = maxContentWidth).fillMaxWidth()
                .heightIn(min = DesignTokens.Layout.Header)
                .padding(horizontal = contentInset, vertical = DesignTokens.Spacing.Xs),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(DesignTokens.Spacing.Small), content = content)
            navigation?.let { tabs ->
                HorizontalDivider(color = WebPalette.Border)
                Box(Modifier.fillMaxWidth().background(WebPalette.Background), contentAlignment = Alignment.Center) {
                    Box(Modifier.widthIn(max = maxContentWidth).fillMaxWidth()
                        .padding(horizontal = contentInset, vertical = DesignTokens.Spacing.Xs), contentAlignment = Alignment.Center) { tabs() }
                }
            }
        }
    }
}
