package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp

@Composable
fun ShareToggle(
    label: String,
    checked: Boolean,
    enabled: Boolean = true,
    change: (Boolean) -> Unit,
) {
    Row(
        Modifier.fillMaxWidth()
            .heightIn(min = 48.dp)
            .toggleable(checked, enabled = enabled, role = Role.Switch, onValueChange = change),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, Modifier.weight(1f), style = ShareTypography.group)
        ShareSwitch(checked, null, enabled = enabled)
    }
}
