package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun WeaponExtraDamageFields(form: FeatureFormScope) {
    val context = LocalCharacterSheet.current
    val rows = form.data["add_attacks"].arrayValue()
    if (rows.isNotEmpty()) Text("Дополнительный урон", style = ShareTypography.group)
    key(rows.size) {
        rows.forEachIndexed { index, raw ->
            val row = raw.objectValue()
            Surface(color = WebPalette.Raised, shape = MaterialTheme.shapes.small) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    SheetNumberInput("Количество костей", row.text("count"), form.enabled) {
                        form.row(listOf("add_attacks"), index, "count", JsonPrimitive(it))
                    }
                    ShareSelect(
                        "Кость",
                        row.text("dice_id"),
                        listOf("d4", "d6", "d8", "d10", "d12", "d20", "d100").map {
                            it to it.replace('d', 'к')
                        },
                        form.enabled,
                    ) {
                        form.row(listOf("add_attacks"), index, "dice_id", JsonPrimitive(it))
                    }
                    ShareSelect(
                        "Тип урона",
                        row.text("type_suggest_id"),
                        listOf("" to "Не выбран") +
                            context.metadata.suggests["12"].orEmpty().map {
                                it.id.toString() to it.value
                            },
                        form.enabled,
                    ) {
                        form.row(
                            listOf("add_attacks"),
                            index,
                            "type_suggest_id",
                            if (it.isBlank()) JsonNull else JsonPrimitive(it.toLong()),
                        )
                    }
                    TextButton(
                        onClick = {
                            form.rows(listOf("add_attacks")) {
                                it.filterIndexed { position, _ -> position != index }
                            }
                        },
                        enabled = form.enabled,
                    ) {
                        Text("Убрать урон", color = WebPalette.Danger)
                    }
                }
            }
        }
    }
    TextButton(
        onClick = {
            form.rows(listOf("add_attacks")) {
                it +
                    buildJsonObject {
                        put("count", 1)
                        put("dice_id", "d6")
                        put("type_suggest_id", JsonNull)
                    }
            }
        },
        enabled = form.enabled,
    ) {
        Text("Добавить урон")
    }
}
