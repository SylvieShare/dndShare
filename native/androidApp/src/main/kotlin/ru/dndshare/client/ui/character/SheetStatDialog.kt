package ru.dndshare.client.ui.character

import androidx.compose.material3.*
import androidx.compose.runtime.*
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.ui.designsystem.*

internal fun SheetEditorState.isDndStat() =
    baseline.templateName == "DND5" && dndAbilities.any { it.id == fields.target }

@Composable
internal fun SheetStatDialog(
    editor: SheetEditorState,
    close: () -> Unit,
    number: (SheetNumberField, String) -> Unit,
    input: (String, kotlinx.serialization.json.JsonElement) -> Unit,
    readInput: () -> JsonObject,
    syncPending: Boolean,
    syncError: String?,
    retry: () -> Unit,
) {
    val inputs = remember(editor.fields.id) { ShareFormInputs() }
    val dismiss = {
        inputs.flush()
        close()
    }
    val ability = dndAbilities.first { it.id == editor.fields.target }
    CompositionLocalProvider(LocalShareFormInputs provides inputs) {
        ShareFormDialog(ability.title, dismiss, dismissEnabled = !editor.saving) {
            SheetNumberInput("Основное значение", editor.fields.number, !editor.saving) {
                number(SheetNumberField.Current, it)
            }
            BonusFields(FeatureFormScope(editor, input, readInput))
            if (syncError != null) {
                Text(syncError, color = WebPalette.Danger)
                ShareTextButton(retry) { Text("Повторить сохранение") }
            } else if (syncPending) Text("Сохраняем изменения…", style = ShareTypography.context)
            editor.fields.error?.let { Text(it, color = WebPalette.Danger) }
        }
    }
}
