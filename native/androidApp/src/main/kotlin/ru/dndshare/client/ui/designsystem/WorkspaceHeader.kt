package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Header with an independently styled navigation surface. */
@Composable
fun ShareWorkspaceHeader(
    modifier: Modifier = Modifier,
    contentInset: Dp = DesignTokens.Spacing.Page,
    maxContentWidth: Dp = DesignTokens.Layout.ContentMax,
    navigation: (@Composable () -> Unit)? = null,
    fitNavigation: Boolean = false,
    compact: Boolean = LocalConfiguration.current.screenWidthDp < DesignTokens.Layout.Desktop.value,
    actions: (@Composable () -> Unit)? = null,
    navigationColor: Color = WebPalette.Subheader,
    navigationRadius: Dp = if (compact) DesignTokens.Radius.CompactNavigation else 0.dp,
    navigationInset: Dp = if (compact) DesignTokens.Layout.CompactHeaderInset else 0.dp,
    navigationPadding: PaddingValues? = null,
    content: @Composable RowScope.() -> Unit,
) {
    val managed = LocalChromeManaged.current
    Surface(
        modifier.fillMaxWidth(),
        color = Color.Transparent,
    ) {
        Column(
            Modifier.fillMaxWidth().drawWithContent {
                if (!managed) {
                    val tint = WebPalette.Background.copy(alpha = DesignTokens.Chrome.Tint)
                    if (navigation == null) drawRect(tint)
                    else
                        drawRect(
                            Brush.verticalGradient(
                                0f to tint,
                                (DesignTokens.Layout.Header.toPx() / size.height).coerceIn(
                                    0f,
                                    1f,
                                ) to tint,
                                1f to Color.Transparent,
                            )
                        )
                }
                drawContent()
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
            ) {
                content()
                actions?.invoke()
            }
            navigation?.let { tabs ->
                androidx.compose.runtime.CompositionLocalProvider(
                    LocalChromeManaged provides true
                ) {
                    ShareSubheader(
                        compact = compact,
                        maxContentWidth = maxContentWidth,
                        contentInset = contentInset,
                        fitContent = fitNavigation,
                        surfaceColor = navigationColor,
                        cornerRadius = navigationRadius,
                        horizontalInset = navigationInset,
                        contentPadding = navigationPadding,
                        content = tabs,
                    )
                }
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
    fitContent: Boolean = false,
    surfaceColor: Color = WebPalette.Subheader,
    cornerRadius: Dp = if (compact) DesignTokens.Radius.CompactNavigation else 0.dp,
    horizontalInset: Dp = if (compact) DesignTokens.Layout.CompactHeaderInset else 0.dp,
    contentPadding: PaddingValues? = null,
    content: @Composable () -> Unit,
) {
    val managed = LocalChromeManaged.current
    Box(
        modifier
            .fillMaxWidth()
            .drawWithContent {
                if (!managed)
                    drawRect(
                        Brush.verticalGradient(
                            listOf(
                                WebPalette.Background.copy(alpha = DesignTokens.Chrome.Tint),
                                Color.Transparent,
                            )
                        )
                    )
                drawContent()
            }
            .padding(
                horizontal = horizontalInset,
                vertical = if (compact) DesignTokens.Spacing.Xs else 0.dp,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Surface(
            Modifier.widthIn(max = maxContentWidth)
                .then(if (fitContent) Modifier else Modifier.fillMaxWidth()),
            color = surfaceColor,
            shape = RoundedCornerShape(cornerRadius),
        ) {
            Box(
                Modifier.padding(
                    contentPadding ?: PaddingValues(
                        horizontal = if (compact) DesignTokens.Spacing.Xs else contentInset,
                        vertical = DesignTokens.Spacing.Xs,
                    )
                ),
                contentAlignment = Alignment.Center,
            ) {
                content()
            }
        }
    }
}
