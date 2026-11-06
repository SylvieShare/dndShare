package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun BonusFields(form: FeatureFormScope) {
    val inputs = LocalShareFormInputs.current
    val bonuses = form.data["bonuses"].arrayValue()
    Text("Бонусы", style = ShareTypography.group)
    key(bonuses.size) {
        bonuses.forEachIndexed { index, raw ->
            val row = raw.bonusRow()
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(DesignTokens.Spacing.Small)) {
                if (row["readonly"] == JsonPrimitive(true)) {
                    Column(Modifier.weight(1f)) {
                        Text(row.label(), style = ShareTypography.group)
                        Text("Источник: " + row.text("source_label").ifBlank { "способности" },
                            style = ShareTypography.context, color = WebPalette.TextMuted)
                    }
                    Text(signed(row["value"].number()), style = ShareTypography.group)
                } else {
                    fun change(key: String, value: String) {
                        val rows = form.data["bonuses"].arrayValue().toMutableList()
                        val current = rows.getOrNull(index)?.bonusRow() ?: return
                        rows[index] = JsonObject(current + (key to JsonPrimitive(value)))
                        form.input("bonuses", JsonArray(rows))
                    }
                    ShareTextInput(
                        row.text("name").ifBlank { row.text("title") },
                        { change(if ("name" in row || "title" !in row) "name" else "title", it) },
                        "Название бонуса", Modifier.weight(1f), enabled = form.enabled, placeholder = "Название",
                    )
                    ShareNumberStepper("Значение бонуса", row.text("value"), form.enabled) { change("value", it) }
                    IconButton(enabled = form.enabled, onClick = {
                        inputs?.flush()
                        form.input("bonuses", JsonArray(form.data["bonuses"].arrayValue().filterIndexed { i, _ -> i != index }))
                    }, modifier = Modifier.semantics { contentDescription = "Удалить бонус" }) {
                        AppGlyph(Glyph.Trash, Modifier.size(18.dp), WebPalette.TextMuted)
                    }
                }
            }
        }
    }
    ShareDashedAction(
        "Добавить бонус",
        onClick = {
            inputs?.flush()
            form.input(
                "bonuses",
                JsonArray(
                    form.data["bonuses"].arrayValue() +
                        buildJsonObject {
                            put("name", "")
                            put("value", 0)
                        }
                ),
            )
        },
        enabled = form.enabled,
        compact = true,
        leadingIcon = Glyph.Plus,
    )
}
