package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.designsystem.*
import java.util.UUID

@Composable
internal fun CharacterSheetEditor(target: String, sheet: CharacterSheet, metadata: HandbookMetadata,
    availableStates: List<CatalogueItem> = emptyList(), close: () -> Unit,
    knownItems: Map<Long, CatalogueItem> = emptyMap(),
    backToList: () -> Unit = {}, refresh: suspend () -> Unit = {},
    submit: suspend (List<SheetPatch>, JsonObject) -> Unit) {
    if (target == "menu" || target == "rest") {
        SheetInformationDialog(target, sheet, close, backToList, refresh)
        return
    }
    val baseline = remember(target) { sheet }
    val hp = baseline.values["hp"].objectValue()
    val maximum = hp["max"]
    val stat = baseline.values[target].objectValue()["value"]
    val vtm = target.split(':')
    val initial = when {
        target == "hp" -> hp["current"].number()
        target.startsWith("vtm:") -> baseline.values[vtm[1]].number()
        stat is JsonObject -> stat["base"].number(10)
        else -> stat.number(10)
    }
    var number by rememberSaveable(target) { mutableStateOf(initial.toString()) }
    var temp by rememberSaveable(target) { mutableStateOf(hp["temp"].number().toString()) }
    var max by rememberSaveable(target) { mutableStateOf((if (maximum is JsonObject) maximum["base"].number() else maximum.number()).toString()) }
    var exhaustion by rememberSaveable(target) { mutableStateOf(baseline.values["exhaustion"].objectValue()["level"].number().toString()) }
    var inspiration by rememberSaveable(target) { mutableStateOf(baseline.values["inspiration"]?.jsonPrimitive?.booleanOrNull == true) }
    val oldStates = baseline.values["states"].arrayValue()
    var selected by rememberSaveable(target) { mutableStateOf(oldStates.mapNotNull { it.objectValue()["effect_id"].referenceId() }) }
    var error by rememberSaveable(target) { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val title = when {
        target == "hp" -> "Здоровье"
        target == "statuses" -> "Состояния"
        target.startsWith("vtm:") -> vtm.getOrNull(2) ?: "Характеристика"
        else -> dndAbilities.firstOrNull { it.id == target }?.title ?: "Показатель"
    }
    AlertDialog(onDismissRequest = { if (!saving) close() }, title = { Text(title, style = ShareTypography.section) },
        text = {
            Column(Modifier.fillMaxWidth().heightIn(max = 560.dp).imePadding().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                if (target == "statuses") {
                    Row { Text("Вдохновение", Modifier.weight(1f)); Switch(inspiration, { inspiration = it }) }
                    SheetNumberInput("Истощение", exhaustion) { exhaustion = it }
                    availableStates.forEach { item ->
                        Row { Text(item.name, Modifier.weight(1f)); Checkbox(item.id in selected, { checked ->
                            selected = if (checked) selected + item.id else selected - item.id
                        }) }
                    }
                } else {
                    SheetNumberInput(if (target == "hp") "Текущие хиты" else "Базовое значение", number) { number = it }
                    if (target == "hp") {
                        SheetNumberInput("Временные хиты", temp) { temp = it }
                        SheetNumberInput("Базовый максимум", max) { max = it }
                    }
                }
                error?.let { Text(it, color = WebPalette.Danger, style = ShareTypography.context) }
            }
        }, confirmButton = { TextButton(enabled = !saving, onClick = {
            fun nonNegative(text: String): Int = text.toIntOrNull()?.takeIf { it >= 0 } ?: kotlin.error("Введите целое неотрицательное число.")
            val patches = runCatching {
                when {
                    target == "hp" -> baseline.hpPatches(nonNegative(number), nonNegative(temp), nonNegative(max))
                    target == "statuses" -> {
                        val level = nonNegative(exhaustion)
                        require(level <= 6) { "Уровень истощения: от 0 до 6." }
                        buildList {
                            addAll(selectedStatusPatches(baseline, selected, knownItems + availableStates.associateBy { it.id }))
                            if (level != baseline.values["exhaustion"].objectValue()["level"].number()) add(if (baseline.values["exhaustion"] is JsonObject) SheetPatch(path = sheetPath("values", "exhaustion", "level"), value = JsonPrimitive(level)) else SheetPatch(path = sheetPath("values", "exhaustion"), value = buildJsonObject { put("level", level) }))
                            if (inspiration != (baseline.values["inspiration"]?.jsonPrimitive?.booleanOrNull == true)) add(SheetPatch(path = sheetPath("values", "inspiration"), value = JsonPrimitive(inspiration)))
                        }
                    }
                    target.startsWith("vtm:") -> listOf(SheetPatch(path = sheetPath("values", vtm[1]), value = JsonPrimitive(nonNegative(number))))
                    else -> listOf(baseline.manualStatPatch(target, nonNegative(number)))
                }
            }.getOrElse { error = it.message; return@TextButton }
            if (patches.isEmpty()) { close(); return@TextButton }
            saving = true
            scope.launch {
                try { submit(patches, baseline.data); close() }
                catch (cancelled: CancellationException) { throw cancelled }
                catch (failed: Exception) { error = failed.message }
                finally { saving = false }
            }
        }) { Text(if (saving) "Сохраняем…" else "Сохранить") } },
        dismissButton = { TextButton(enabled = !saving, onClick = close) { Text("Отмена") } })
}

@Composable
private fun SheetNumberInput(label: String, value: String, change: (String) -> Unit) {
    OutlinedTextField(value, change, label = { Text(label) }, singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
}
