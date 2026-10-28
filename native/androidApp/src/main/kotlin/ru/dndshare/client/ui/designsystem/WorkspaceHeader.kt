package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Flat compact chrome and a separate rounded navigation surface. */
@Composable
fun ShareWorkspaceHeader(
    modifier: Modifier = Modifier,
    contentInset: Dp = DesignTokens.Spacing.Page,
    maxContentWidth: Dp = DesignTokens.Layout.ContentMax,
    navigation: (@Composable () -> Unit)? = null,
    compact: Boolean = LocalConfiguration.current.screenWidthDp < DesignTokens.Layout.Desktop.value,
    content: @Composable RowScope.() -> Unit,
) {
    Surface(
        modifier.fillMaxWidth(),
        color = if (compact) Color.Transparent else WebPalette.Surface,
        shadowElevation = if (compact) 0.dp else 4.dp,
    ) {
        Column(
            Modifier.fillMaxWidth().drawWithContent {
                drawContent()
                if (!compact) {
                    val stroke = DesignTokens.Layout.Border.toPx()
                    drawLine(
                        WebPalette.BorderStrong,
                        Offset(0f, size.height - stroke / 2),
                        Offset(size.width, size.height - stroke / 2),
                        strokeWidth = stroke,
                    )
                }
            },
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(
                Modifier.widthIn(max = maxContentWidth)
                    .fillMaxWidth()
                    .heightIn(min = DesignTokens.Layout.Header)
                    .padding(horizontal = contentInset, vertical = DesignTokens.Spacing.Xs),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(DesignTokens.Spacing.Small),
                content = content,
            )
            navigation?.let { tabs ->
                if (!compact) HorizontalDivider(color = WebPalette.Border)
                ShareSubheader(
                    compact = compact,
                    maxContentWidth = maxContentWidth,
                    contentInset = contentInset,
                    content = tabs,
                )
            }
        }
    }
}

@Composable
fun ShareSubheader(
    modifier: Modifier = Modifier,
    compact: Boolean = true,
    maxContentWidth: Dp = DesignTokens.Layout.ContentMax,
    contentInset: Dp = DesignTokens.Layout.CompactHeaderInset,
    content: @Composable () -> Unit,
) {
    Box(
        modifier
            .fillMaxWidth()
            .padding(
                horizontal = if (compact) DesignTokens.Layout.CompactHeaderInset else 0.dp,
                vertical = if (compact) DesignTokens.Spacing.Xs else 0.dp,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Surface(
            Modifier.widthIn(max = maxContentWidth).fillMaxWidth(),
            color = if (compact) WebPalette.Surface else WebPalette.Background,
            shape =
                RoundedCornerShape(if (compact) DesignTokens.Radius.CompactNavigation else 0.dp),
        ) {
            Box(
                Modifier.padding(
                    horizontal = if (compact) DesignTokens.Spacing.Xs else contentInset,
                    vertical = DesignTokens.Spacing.Xs,
                ),
                contentAlignment = Alignment.Center,
            ) {
                content()
            }
        }
    }
}
