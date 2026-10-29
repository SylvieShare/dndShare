package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/** A labelled native choice control for compact forms; options contain presentation values only. */
@Composable
fun ShareSelect(
    label: String,
    value: String,
    options: List<Pair<String, String>>,
    enabled: Boolean = true,
    change: (String) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        FieldCaption(label)
        Box {
            Surface(
                onClick = { open = true },
                enabled = enabled,
                color =
                    if (open) WebPalette.Accent.copy(alpha = .18f).compositeOver(WebPalette.Raised)
                    else WebPalette.Raised,
                shape =
                    androidx.compose.foundation.shape.RoundedCornerShape(DesignTokens.Radius.Input),
                modifier =
                    Modifier.fillMaxWidth()
                        .heightIn(min = DesignTokens.Layout.InputHeight)
                        .semantics {
                            contentDescription = label
                        },
            ) {
                Row(
                    Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        options.firstOrNull { it.first == value }?.second ?: "Выбрать",
                        Modifier.weight(1f),
                        style = fieldTextStyle,
                    )
                    AppGlyph(Glyph.Chevron, Modifier.size(16.dp), WebPalette.TextMuted)
                }
            }
            ShareDropdownMenu(open, { open = false }, Modifier.heightIn(max = 360.dp)) {
                options.forEach { (key, title) ->
                    ShareDropdownMenuItem(
                        text = {
                            Text(
                                title,
                                color =
                                    if (value == key) WebPalette.AccentSoft else WebPalette.Text,
                            )
                        },
                        onClick = {
                            change(key)
                            open = false
                        },
                    )
                }
            }
        }
    }
}
