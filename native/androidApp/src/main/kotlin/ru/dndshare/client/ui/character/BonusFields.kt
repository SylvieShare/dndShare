package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.RoundedCornerShape
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
            val row = raw.objectValue()
            if (row["readonly"] == JsonPrimitive(true))
                Text(
                    "${row.label()} ${signed(row["value"].number())}",
                    style = ShareTypography.context,
                )
            else {
                fun change(key: String, value: String) =
                    form.row(listOf("bonuses"), index, key, JsonPrimitive(value))
                Surface(color = WebPalette.Raised, shape = RoundedCornerShape(10.dp)) {
                    Column(Modifier.fillMaxWidth().padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            ShareTextInput(
                                row.text("name").ifBlank { row.text("title") },
                                { change(if ("name" in row) "name" else "title", it) },
                                "Название бонуса", Modifier.weight(1f), enabled = form.enabled,
                            )
                            IconButton(enabled = form.enabled, onClick = {
                                inputs?.flush()
                                form.input("bonuses", JsonArray(form.data["bonuses"].arrayValue().filterIndexed { i, _ -> i != index }))
                            }, modifier = Modifier.semantics { contentDescription = "Удалить бонус" }) {
                                AppGlyph(Glyph.Trash, Modifier.size(18.dp), WebPalette.TextMuted)
                            }
                        }
                        SheetNumberInput("Значение", row.text("value"), form.enabled) { change("value", it) }
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
                            put("title", "Бонус")
                            put("value", 0)
                        }
                ),
            )
        },
        enabled = form.enabled,
        compact = true,
    )
}
