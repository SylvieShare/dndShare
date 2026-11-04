package ru.dndshare.client.ui.designsystem

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Composable
fun ShareChoiceCard(
    label: String,
    description: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    color: Color = WebPalette.Accent,
    minHeight: Dp = 88.dp,
    enabled: Boolean = true,
    icon: @Composable (Color) -> Unit,
) {
    val background by animateColorAsState(
        if (selected) lerp(WebPalette.Background, color, .24f) else WebPalette.Background,
        label = "Choice card background",
    )
    val foreground by animateColorAsState(
        if (selected) lerp(color, WebPalette.Text, .28f) else WebPalette.TextMuted,
        label = "Choice card icon",
    )
    val checkOpacity by animateFloatAsState(if (selected) 1f else 0f, label = "Choice card check")

    Column(
        modifier
            .heightIn(min = minHeight)
            .alpha(if (enabled) 1f else .45f)
            .clip(RoundedCornerShape(DesignTokens.Radius.Medium))
            .background(background)
            .selectable(selected, enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(DesignTokens.Spacing.Medium),
        verticalArrangement = Arrangement.spacedBy(DesignTokens.Spacing.Small),
    ) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            icon(foreground)
            AppGlyph(Glyph.CircleCheck, Modifier.size(20.dp).alpha(checkOpacity), foreground)
        }
        Column {
            Text(label, color = WebPalette.Text, style = ShareTypography.group.copy(fontWeight = FontWeight.SemiBold))
            if (description.isNotEmpty()) {
                Text(
                    description,
                    color = if (selected) WebPalette.TextSecondary else WebPalette.TextMuted,
                    style = ShareTypography.context.copy(fontWeight = FontWeight.Normal),
                )
            }
        }
    }
}
