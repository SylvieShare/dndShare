package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.character.*
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.designsystem.*

internal fun SheetEditorState.isDndStat() = baseline.templateName == "DND5" && dndAbilities.any { it.id == fields.target }

@Composable
internal fun SheetStatMorph(morph: ShareMorphState, editor: SheetEditorState?, format: LayoutFormat,
    close: () -> Unit, number: (SheetNumberField, String) -> Unit, submit: () -> Unit) {
    val current = editor?.takeIf { it.isDndStat() }
    var retained by remember { mutableStateOf(current) }
    SideEffect { if (current != null) retained = current }
    val shown = current ?: retained
    val ability = dndAbilities.firstOrNull { it.id == shown?.fields?.target }
    val context = LocalCharacterSheet.current
    ShareMorphDialog(morph, current?.fields?.target, ability?.title ?: "Характеристика", current?.saving != true, close,
        preview = {
            if (shown != null && ability != null) {
                val value = shown.fields.number.toIntOrNull()?.takeIf { it >= 0 }
                val projected = remember(context.sheet, shown.fields.number) {
                    if (value == null) context.sheet else context.sheet.copy(data = applySheetPatches(context.sheet.data,
                        listOf(context.sheet.manualStatPatch(ability.id, value))))
                }
                CompositionLocalProvider(LocalCharacterSheet provides context.copy(sheet = projected, canEdit = false,
                    mechanics = remember(projected, context.items, context.metadata) { DndDerivedValues(projected, context.items, context.metadata) })) {
                    DndAbilityTile(ability, format != LayoutFormat.Wide, preview = true)
                }
            }
        }, editor = {
            if (shown != null && ability != null) Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(ability.title, Modifier.weight(1f), style = ShareTypography.section)
                    IconButton(onClick = close, enabled = !shown.saving,
                        modifier = Modifier.semantics { contentDescription = "Закрыть редактор" }) { AppGlyph(Glyph.Close) }
                }
                ShareSection("Значение") {
                    SheetNumberInput("Основное значение", shown.fields.number, !shown.saving) { number(SheetNumberField.Current, it) }
                    val numeric = shown.baseline.values[ability.id].objectValue()["value"]
                    val bonuses = (numeric as? JsonObject)?.get("bonuses").arrayValue()
                    if (bonuses.isNotEmpty()) Text("Бонусы: ${signed(bonuses.sumOf { it.objectValue()["value"].number() })}", style = ShareTypography.context, color = WebPalette.TextSecondary)
                }
                shown.fields.error?.let { Text(it, color = WebPalette.Danger, style = ShareTypography.context) }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End)) {
                    TextButton(onClick = close, enabled = !shown.saving) { Text("Отмена") }
                    Button(onClick = submit, enabled = !shown.saving) { Text(if (shown.saving) "Сохраняем…" else "Сохранить") }
                }
            }
        })
}
