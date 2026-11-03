package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/** Searchable presentation-only multi-select with optional free-text entries. */
@Composable
fun ShareTokenInput(
    value: List<String>,
    change: (List<String>) -> Unit,
    label: String,
    options: List<String> = emptyList(),
    allowCreate: Boolean = false,
    limit: Int = 32,
    maxTokenLength: Int = 64,
    showLabel: Boolean = true,
    placeholder: String? = null,
    leadingIcon: (@Composable () -> Unit)? = { AppGlyph(Glyph.Tags) },
) {
    var open by remember { mutableStateOf(false) }
    var query by remember { mutableStateOf("") }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (showLabel)
            Text(label, style = ShareTypography.context, color = WebPalette.TextSecondary)
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            value.forEach { token ->
                ShareChoiceChip(
                    selected = true,
                    onClick = { change(value - token) },
                    label = { Text(token) },
                    trailingIcon = { AppGlyph(Glyph.Close, Modifier.size(14.dp)) },
                )
            }
        }
        Box {
            ShareTonalButton({ open = !open }, modifier = Modifier.fillMaxWidth()) {
                leadingIcon?.invoke()
                Text(
                    placeholder ?: if (allowCreate) "Выбрать или добавить тег…" else "Выбрать теги…"
                )
            }
            ShareDropdownMenu(open, { open = false }, Modifier.widthIn(min = 240.dp)) {
                ShareTextInput(query, { query = it }, "Поиск тегов")
                val found =
                    (options + value)
                        .distinctBy { it.lowercase() }
                        .filter { it.contains(query, ignoreCase = true) }
                        .sortedBy { it.lowercase() }
                found.forEach { token ->
                    val selected = value.any { it.equals(token, ignoreCase = true) }
                    ShareDropdownMenuItem(
                        text = { Text(token) },
                        onClick = {
                            change(
                                if (selected)
                                    value.filterNot { it.equals(token, ignoreCase = true) }
                                else value + token
                            )
                        },
                        leadingIcon = { AppGlyph(if (selected) Glyph.CircleCheck else Glyph.Tags) },
                        enabled = selected || value.size < limit,
                    )
                }
                val candidate = query.trim().replace(Regex("\\s+"), " ")
                if (
                    allowCreate &&
                        candidate.isNotEmpty() &&
                        (value + options).none { it.equals(candidate, ignoreCase = true) }
                )
                    ShareDropdownMenuItem(
                        text = { Text("Добавить «$candidate»") },
                        leadingIcon = { AppGlyph(Glyph.Plus) },
                        enabled = candidate.length <= maxTokenLength && value.size < limit,
                        onClick = {
                            change(value + candidate)
                            query = ""
                        },
                    )
                if (found.isEmpty() && (!allowCreate || candidate.isEmpty()))
                    Text(
                        "Тег не найден",
                        style = ShareTypography.context,
                        color = WebPalette.TextMuted,
                    )
            }
        }
    }
}
