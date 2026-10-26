package ru.dndshare.client.ui

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight

private val Dark = darkColorScheme(
    primary = Color(0xFFB9A8FF), onPrimary = Color(0xFF251745),
    primaryContainer = Color(0xFF342651), onPrimaryContainer = Color(0xFFEADFFF),
    background = Color(0xFF111219), surface = Color(0xFF191A24),
    surfaceVariant = Color(0xFF252633), outlineVariant = Color(0xFF363743),
)

@Composable
fun DndTheme(content: @Composable () -> Unit) {
    val typography = Typography()
    MaterialTheme(
        colorScheme = Dark,
        typography = typography.copy(
            titleLarge = typography.titleLarge.copy(fontWeight = FontWeight.SemiBold),
            titleMedium = typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
        ),
        content = content,
    )
}
