package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import ru.dndshare.client.model.CatalogueItem
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun CharacterSheetEditor(editor: SheetEditorState, availableStates: List<CatalogueItem>, close: () -> Unit,
    number: (SheetNumberField, String) -> Unit, inspiration: (Boolean) -> Unit,
    status: (Long, Boolean) -> Unit, submit: () -> Unit) {
    val fields = editor.fields
    val title = when {
        fields.target == "hp" -> "Здоровье"
        fields.target == "statuses" -> "Состояния"
        fields.target.startsWith("vtm:") -> fields.target.split(':').getOrNull(2) ?: "Характеристика"
        else -> dndAbilities.firstOrNull { it.id == fields.target }?.title ?: "Показатель"
    }
    AlertDialog(onDismissRequest = { if (!editor.saving) close() }, title = { Text(title, style = ShareTypography.section) },
        text = {
            Column(Modifier.fillMaxWidth().heightIn(max = 560.dp).imePadding().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                if (fields.target == "statuses") {
                    Row { Text("Вдохновение", Modifier.weight(1f)); Switch(fields.inspiration, inspiration, enabled = !editor.saving) }
                    SheetNumberInput("Истощение", fields.exhaustion, !editor.saving) { number(SheetNumberField.Exhaustion, it) }
                    availableStates.forEach { item -> Row {
                        Text(item.name, Modifier.weight(1f))
                        Checkbox(item.id in fields.selected, { status(item.id, it) }, enabled = !editor.saving)
                    } }
                } else {
                    SheetNumberInput(if (fields.target == "hp") "Текущие хиты" else "Базовое значение", fields.number, !editor.saving) { number(SheetNumberField.Current, it) }
                    if (fields.target == "hp") {
                        SheetNumberInput("Временные хиты", fields.temp, !editor.saving) { number(SheetNumberField.Temporary, it) }
                        SheetNumberInput("Базовый максимум", fields.maximum, !editor.saving) { number(SheetNumberField.Maximum, it) }
                    }
                }
                fields.error?.let { Text(it, color = WebPalette.Danger, style = ShareTypography.context) }
            }
        }, confirmButton = { TextButton(enabled = !editor.saving, onClick = submit) { Text(if (editor.saving) "Сохраняем…" else "Сохранить") } },
        dismissButton = { TextButton(enabled = !editor.saving, onClick = close) { Text("Отмена") } })
}

@Composable
internal fun SheetNumberInput(label: String, value: String, enabled: Boolean = true, change: (String) -> Unit) {
    OutlinedTextField(value, change, label = { Text(label) }, singleLine = true, enabled = enabled,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
}
