package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics

/** A single accessible switch target, including the label and optional supporting text. */
@Composable
fun ShareToggle(
    label: String,
    checked: Boolean,
    enabled: Boolean = true,
    modifier: Modifier = Modifier,
    description: String? = null,
    change: (Boolean) -> Unit,
) {
    Row(
        modifier
            .fillMaxWidth()
            .heightIn(min = DesignTokens.Layout.TouchMin)
            .toggleable(checked, enabled = enabled, role = Role.Switch, onValueChange = change)
            .semantics(mergeDescendants = true) {}
            .alpha(if (enabled) 1f else .45f),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(DesignTokens.Spacing.Small),
    ) {
        Column(
            Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(DesignTokens.Spacing.Xs),
        ) {
            Text(label, style = ShareTypography.group)
            description?.takeIf(String::isNotBlank)?.let {
                Text(it, style = ShareTypography.context, color = WebPalette.TextSecondary)
            }
        }
        ShareSwitch(checked, null)
    }
}
