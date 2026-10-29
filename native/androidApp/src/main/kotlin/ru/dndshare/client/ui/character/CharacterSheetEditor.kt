package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun CharacterSheetEditor(
    editor: SheetEditorState,
    cache: CacheDao,
    close: () -> Unit,
    number: (SheetNumberField, String) -> Unit,
    inspiration: (Boolean) -> Unit,
    submit: () -> Unit,
    calculateHealth: (String, String) -> Unit = { _, _ -> },
    input: (String, JsonElement) -> Unit = { _, _ -> },
    readInput: (() -> JsonObject)? = null,
) {
    val fields = editor.fields
    var expression by remember(editor.fields.id) { mutableStateOf("") }
    val title =
        when {
            fields.target == "hp" -> "Здоровье"
            fields.target == "statuses" -> "Состояния"
            fields.target.startsWith("vtm:") ->
                fields.target.split(':').getOrNull(2) ?: "Характеристика"
            else -> dndAbilities.firstOrNull { it.id == fields.target }?.title ?: "Показатель"
        }
    val inputs = remember(editor.fields.id) { ShareFormInputs() }
    CompositionLocalProvider(LocalShareFormInputs provides inputs) {
        ShareAlertDialog(
            onDismissRequest = { if (!editor.saving) close() },
            title = { Text(title, style = ShareTypography.header) },
            text = {
                Column(
                    Modifier.fillMaxWidth()
                        .heightIn(max = 560.dp)
                        .imePadding()
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    if (fields.target == "statuses") {
                        ShareToggle(
                            "Вдохновение",
                            fields.inspiration,
                            enabled = !editor.saving,
                            change = inspiration,
                        )
                        SheetNumberInput("Истощение", fields.exhaustion, !editor.saving) {
                            number(SheetNumberField.Exhaustion, it)
                        }
                        StatusInstanceFields(FeatureFormScope(editor, input, readInput), cache)
                    } else {
                        if (fields.target == "hp") {
                            ShareCalcPad(expression, { expression = it }, !editor.saving)
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                for ((kind, label) in
                                    listOf(
                                        "damage" to "Урон",
                                        "heal" to "Лечение",
                                        "temp" to "Временные",
                                    )) ShareTextButton(
                                    onClick = {
                                        inputs.flush()
                                        calculateHealth(kind, expression)
                                        expression = ""
                                    },
                                    enabled = !editor.saving && expression.isNotBlank(),
                                ) {
                                    Text(label)
                                }
                            }
                        }
                        key(fields.input["hpRevision"]) {
                            SheetNumberInput(
                                if (fields.target == "hp") "Текущие хиты" else "Базовое значение",
                                fields.number,
                                !editor.saving,
                            ) {
                                number(SheetNumberField.Current, it)
                            }
                            if (fields.target == "hp") {
                                SheetNumberInput("Временные хиты", fields.temp, !editor.saving) {
                                    number(SheetNumberField.Temporary, it)
                                }
                                SheetNumberInput(
                                    "Базовый максимум",
                                    fields.maximum,
                                    !editor.saving,
                                ) {
                                    number(SheetNumberField.Maximum, it)
                                }
                                BonusFields(FeatureFormScope(editor, input, readInput))
                                DeathSaveFields(editor, input, number)
                            }
                        }
                    }
                    fields.error?.let {
                        Text(it, color = WebPalette.Danger, style = ShareTypography.context)
                    }
                }
            },
            confirmButton = {
                ShareTextButton(
                    enabled = !editor.saving,
                    onClick = {
                        inputs.flush()
                        submit()
                    },
                ) {
                    Text(if (editor.saving) "Сохраняем…" else "Сохранить")
                }
            },
            dismissButton = {
                ShareTextButton(enabled = !editor.saving, onClick = close) { Text("Отмена") }
            },
        )
    }
}

@Composable
private fun DeathSaveFields(
    editor: SheetEditorState,
    input: (String, JsonElement) -> Unit,
    number: (SheetNumberField, String) -> Unit,
) {
    val hp = editor.baseline.values["hp"].objectValue()
    if ((editor.fields.number.toIntOrNull() ?: 0) > 0) return
    Text("Спасброски от смерти", style = ShareTypography.group)
    for ((key, label) in listOf("ds_failure" to "Провалы", "ds_success" to "Успехи")) {
        val count = (editor.fields.input[key] ?: hp[key]).number().coerceIn(0, 3)
        Text(label, style = ShareTypography.context)
        Row {
            for (index in 1..3) ShareChoiceChip(
                count >= index,
                {
                    val projected =
                        JsonObject(
                            hp +
                                editor.fields.input +
                                ("current" to
                                    JsonPrimitive(editor.fields.number.toIntOrNull() ?: 0))
                        )
                    val next = deathSaveChange(projected, key, index)
                    if (next["current"].number() == 1) {
                        number(SheetNumberField.Current, "1")
                        input("ds_success", JsonPrimitive(0))
                        input("ds_failure", JsonPrimitive(0))
                    } else input(key, next.getValue(key))
                },
                label = { Text(index.toString()) },
                enabled = !editor.saving,
            )
        }
    }
}

@Composable
internal fun SheetNumberInput(
    label: String,
    value: String,
    enabled: Boolean = true,
    change: (String) -> Unit,
) {
    ShareNumberInput(label, value, enabled, change)
}
