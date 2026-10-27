package ru.dndshare.client.ui.designsystem

import androidx.compose.material3.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.graphics.lerp

private val Dark = darkColorScheme(
    primary = WebPalette.AccentSoft, onPrimary = WebPalette.Background,
    primaryContainer = lerp(WebPalette.Surface, WebPalette.Accent, .14f), onPrimaryContainer = WebPalette.AccentSoft,
    secondary = WebPalette.AccentSoft, onSecondary = WebPalette.Background,
    secondaryContainer = lerp(WebPalette.Surface, WebPalette.Accent, .12f), onSecondaryContainer = WebPalette.Text,
    tertiary = WebPalette.Info, onTertiary = WebPalette.Background,
    tertiaryContainer = lerp(WebPalette.Surface, WebPalette.Info, .14f), onTertiaryContainer = WebPalette.Text,
    background = WebPalette.Background, onBackground = WebPalette.Text,
    surface = WebPalette.Surface, onSurface = WebPalette.Text,
    surfaceVariant = WebPalette.Raised, onSurfaceVariant = WebPalette.TextSecondary,
    surfaceDim = WebPalette.Background, surfaceBright = WebPalette.Active,
    surfaceContainerLowest = WebPalette.Background, surfaceContainerLow = WebPalette.Popover,
    surfaceContainer = WebPalette.Surface, surfaceContainerHigh = WebPalette.Raised,
    surfaceContainerHighest = WebPalette.Active, surfaceTint = Color.Transparent,
    outline = WebPalette.BorderStrong, outlineVariant = WebPalette.Border,
    error = WebPalette.Danger, onError = WebPalette.OnAccent,
    errorContainer = lerp(WebPalette.Surface, WebPalette.Danger, .18f), onErrorContainer = WebPalette.Text,
    inverseSurface = WebPalette.Text, inverseOnSurface = WebPalette.Background,
    inversePrimary = WebPalette.Accent, scrim = Color.Black,
)

@Composable
fun ShareTheme(colors: ColorScheme = Dark, content: @Composable () -> Unit) {
    val typography = Typography()
    MaterialTheme(
        colorScheme = colors,
        typography = typography.copy(
            titleLarge = typography.titleLarge.copy(fontWeight = FontWeight.SemiBold),
            titleMedium = typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
        ),
        shapes = Shapes(extraSmall = RoundedCornerShape(DesignTokens.Radius.Xs), small = RoundedCornerShape(DesignTokens.Radius.Small),
            medium = RoundedCornerShape(DesignTokens.Radius.Medium), large = RoundedCornerShape(DesignTokens.Radius.Large), extraLarge = RoundedCornerShape(DesignTokens.Radius.Xl)),
        content = content,
    )
}
