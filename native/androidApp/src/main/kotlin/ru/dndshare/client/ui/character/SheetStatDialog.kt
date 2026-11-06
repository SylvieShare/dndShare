package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

internal fun isStatEditorTarget(target: String): Boolean {
    val parts = target.split(':')
    return (parts.size == 1 && dndAbilities.any { it.id == target }) ||
        (parts.size == 3 && parts[0] == "skill" && parts[2].isNotBlank() && dndAbilities.any { it.id == parts[1] })
}

internal fun SheetEditorState.isDndStat() = baseline.templateName == "DND5" && isStatEditorTarget(fields.target)

internal fun SheetContext.proficientRollTotal(
    ability: DndAbility, scope: RuleContext, rank: Int, bonuses: JsonElement?,
): Int {
    val effect = if (scope.kind == "saving_throw") mechanics.bonus("save_bonus", scope)
        else mechanics.bonus("skill_bonus", scope.copy(proficient = rank > 0))
    return abilityModifier(mechanics.score(ability.id)) + rank * sheet.proficiency() + bonuses.bonusTotal() + effect
}

@Composable
internal fun SheetStatDialog(
    editor: SheetEditorState,
    close: () -> Unit,
    number: (SheetNumberField, String) -> Unit,
    input: (String, JsonElement) -> Unit,
    readInput: () -> JsonObject,
    syncError: String?,
    retry: () -> Unit,
) {
    val context = LocalCharacterSheet.current
    val parts = editor.fields.target.split(':')
    val ability = dndAbilities.first { it.id == (parts.getOrNull(1) ?: parts[0]) }
    val id = parts.getOrNull(2)
    val original = id?.let { key ->
        context.metadata.suggests["15"]?.firstOrNull { it.id.toString() == key }?.value ?: skillNames[key.toIntOrNull()]
    }
    val title = when (id) {
        null -> ability.title
        "save" -> "${ability.title} — спасбросок"
        else -> editor.fields.input.text("override_title").ifBlank { original ?: "Навык" }
    }
    val form = FeatureFormScope(editor, input, readInput)
    val total = if (id == null) editor.fields.number.toIntOrNull()?.let {
        context.mechanics.score(ability.id, it + form.data["bonuses"].bonusTotal()).toString()
    } ?: "—" else signed(context.skillEditorTotal(ability, id, form.data))
    val inputs = remember(editor.fields.id) { ShareFormInputs() }
    var removing by remember(editor.fields.id) { mutableStateOf(false) }
    CompositionLocalProvider(LocalShareFormInputs provides inputs) {
        ShareWindow(modifier = Modifier.widthIn(max = DesignTokens.Layout.StatEditorWidth + 24.dp), onDismissRequest = { inputs.flush(); close() }, dismissEnabled = !editor.saving,
            title = {
                Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(buildAnnotatedString {
                        append(title)
                        if (id != "save" && !original.isNullOrBlank() && original != title)
                            withStyle(SpanStyle(color = WebPalette.TextMuted)) { append(" ($original)") }
                    }, Modifier.weight(1f), style = ShareTypography.header)
                    Text("Итого", style = ShareTypography.context, color = WebPalette.TextMuted)
                    Text(total, style = ShareTypography.header)
                }
            },
        ) {
            if (id == null) {
                SheetNumberInput("Основное значение", editor.fields.number, !editor.saving) {
                    number(SheetNumberField.Current, it)
                }
                BonusFields(form)
            } else SkillFeatureFields(form) { removing = true }
            if (syncError != null) {
                Text(syncError, color = WebPalette.Danger)
                ShareTextButton(retry) { Text("Повторить сохранение") }
            }
            editor.fields.error?.let { Text(it, color = WebPalette.Danger) }
        }
    }
    if (removing) ShareAlertDialog(
        onDismissRequest = { removing = false },
        title = { Text("Удалить навык «$title»?") },
        confirmButton = { ShareTextButton(onClick = {
            inputs.flush()
            input("deleteConfirmed", JsonPrimitive(true))
            removing = false
            close()
        }) { Text("Удалить", color = WebPalette.Danger) } },
        dismissButton = { ShareTextButton(onClick = { removing = false }) { Text("Отмена") } },
    )
}
