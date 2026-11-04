package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SheetRollModePicker(
    mode: String,
    onChange: (String) -> Unit,
    neutralMode: String = "normal",
    enabled: Boolean = true,
) {
    Row(
        Modifier.fillMaxWidth().height(IntrinsicSize.Min),
        horizontalArrangement = Arrangement.spacedBy(DesignTokens.Spacing.Small),
    ) {
        ShareChoiceCard(
            label = "Помеха",
            description = "Меньший из 2к20",
            selected = mode == "disadvantage",
            onClick = { onChange(if (mode == "disadvantage") neutralMode else "disadvantage") },
            modifier = Modifier.weight(1f).fillMaxHeight(),
            color = WebPalette.Danger,
            minHeight = DesignTokens.Layout.RollModeCardMinHeight,
            enabled = enabled,
        ) { tint -> AppGlyph(Glyph.Down, Modifier.size(20.dp), tint) }
        ShareChoiceCard(
            label = "Преимущество",
            description = "Больший из 2к20",
            selected = mode == "advantage",
            onClick = { onChange(if (mode == "advantage") neutralMode else "advantage") },
            modifier = Modifier.weight(1f).fillMaxHeight(),
            color = WebPalette.Success,
            minHeight = DesignTokens.Layout.RollModeCardMinHeight,
            enabled = enabled,
        ) { tint -> AppGlyph(Glyph.Up, Modifier.size(20.dp), tint) }
    }
}
