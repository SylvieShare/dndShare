package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

data class ShareMenuAction(
    val label: String,
    val icon: Glyph,
    val run: () -> Unit,
    val enabled: Boolean = true,
    val danger: Boolean = false,
)

@Composable
fun ShareActionMenu(
    label: String,
    actions: List<ShareMenuAction>,
    trigger: (@Composable (Modifier, () -> Unit, Boolean) -> Unit)? = null,
    ownerKey: Any? = label,
) {
    var open by remember(ownerKey) { mutableStateOf(false) }
    Box {
        if (trigger != null)
            trigger(Modifier.semantics { contentDescription = label }, { open = true }, open)
        else
            IconButton(
                onClick = { open = true },
                modifier = Modifier.semantics { contentDescription = label },
            ) {
                AppGlyph(Glyph.More)
            }
        ShareDropdownMenu(open, { open = false }) {
            actions.forEach { action ->
                ShareDropdownMenuItem(
                    text = {
                        Text(
                            action.label,
                            color =
                                (if (action.danger) WebPalette.Danger else WebPalette.Text).copy(
                                    alpha = if (action.enabled) 1f else .5f
                                ),
                        )
                    },
                    leadingIcon = {
                        AppGlyph(
                            action.icon,
                            Modifier.size(18.dp),
                            (if (action.danger) WebPalette.Danger else WebPalette.TextSecondary)
                                .copy(alpha = if (action.enabled) 1f else .5f),
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
