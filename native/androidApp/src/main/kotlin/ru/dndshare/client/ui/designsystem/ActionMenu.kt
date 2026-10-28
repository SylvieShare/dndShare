package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.layout.Box
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics

data class ShareMenuAction(
    val label: String,
    val run: () -> Unit,
    val enabled: Boolean = true,
    val danger: Boolean = false,
)

@Composable
fun ShareActionMenu(
    label: String,
    actions: List<ShareMenuAction>,
    trigger: (@Composable (Modifier, () -> Unit) -> Unit)? = null,
    ownerKey: Any? = label,
) {
    var open by remember(ownerKey) { mutableStateOf(false) }
    Box {
        if (trigger != null)
            trigger(Modifier.semantics { contentDescription = label }, { open = true })
        else
            IconButton(
                onClick = { open = true },
                modifier = Modifier.semantics { contentDescription = label },
            ) {
                Text("⋯", style = ShareTypography.section)
            }
        ShareDropdownMenu(open, { open = false }) {
            actions.forEach { action ->
                ShareDropdownMenuItem(
                    text = {
                        Text(
                            action.label,
                            color = if (action.danger) WebPalette.Danger else WebPalette.Text,
                        )
                    },
                    enabled = action.enabled,
                    onClick = {
                        open = false
                        action.run()
                    },
                )
            }
        }
    }
}
