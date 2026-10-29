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

/** Flat compact chrome and a separate rounded navigation surface. */
@Composable
fun ShareWorkspaceHeader(
    modifier: Modifier = Modifier,
    contentInset: Dp = DesignTokens.Spacing.Page,
    maxContentWidth: Dp = DesignTokens.Layout.ContentMax,
    navigation: (@Composable () -> Unit)? = null,
    compact: Boolean = LocalConfiguration.current.screenWidthDp < DesignTokens.Layout.Desktop.value,
    actions: (@Composable () -> Unit)? = null,
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
                horizontal = if (compact) DesignTokens.Layout.CompactHeaderInset else 0.dp,
                vertical = if (compact) DesignTokens.Spacing.Xs else 0.dp,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Surface(
            Modifier.widthIn(max = maxContentWidth).fillMaxWidth(),
            color = WebPalette.Subheader,
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
