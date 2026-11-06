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
import androidx.compose.ui.unit.sp

@Composable
fun ShareChoiceCard(
    label: String,
    description: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    color: Color = WebPalette.Accent,
    minHeight: Dp = 52.dp,
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

    val titleStyle = ShareTypography.group.copy(
        fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.SemiBold,
    )
    val detailColor = if (selected) WebPalette.TextSecondary else WebPalette.TextMuted
    Row(
        modifier
            .heightIn(min = minHeight)
            .alpha(if (enabled) 1f else .45f)
            .clip(RoundedCornerShape(DesignTokens.Radius.Medium))
            .background(background)
            .selectable(selected, enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(DesignTokens.Spacing.Small),
        horizontalArrangement = Arrangement.spacedBy(DesignTokens.Spacing.Compact),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        icon(foreground)
        Column(Modifier.weight(1f)) {
            if (description.isNotEmpty()) Text(label, style = titleStyle, color = WebPalette.Text)
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(DesignTokens.Spacing.Compact),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (description.isEmpty()) {
                    Text(label, Modifier.weight(1f), style = titleStyle, color = WebPalette.Text)
                } else {
                    Text(
                        description,
                        Modifier.weight(1f),
                        style = ShareTypography.context.copy(fontWeight = FontWeight.Normal),
                        color = detailColor,
                    )
                }
                AppGlyph(Glyph.CircleCheck, Modifier.size(12.dp).alpha(checkOpacity), foreground)
            }
        }
    }
}
