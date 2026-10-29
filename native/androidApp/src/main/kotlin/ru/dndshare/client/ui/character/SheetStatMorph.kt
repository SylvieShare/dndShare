package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.character.*
import ru.dndshare.client.ui.designsystem.*

internal fun SheetEditorState.isDndStat() =
    baseline.templateName == "DND5" && dndAbilities.any { it.id == fields.target }

@Composable
internal fun SheetStatMorph(
    morph: ShareMorphState,
    editor: SheetEditorState?,
    close: () -> Unit,
    number: (SheetNumberField, String) -> Unit,
    submit: () -> Unit,
    input: (String, kotlinx.serialization.json.JsonElement) -> Unit,
    readInput: () -> JsonObject,
    items: Map<Long, ru.dndshare.client.model.CatalogueItem>,
    metadata: ru.dndshare.client.model.HandbookMetadata,
) {
    val current = editor?.takeIf { it.isDndStat() }
    var retained by remember { mutableStateOf(current) }
    SideEffect { if (current != null) retained = current }
    val shown = current ?: retained
    val ability = dndAbilities.firstOrNull { it.id == shown?.fields?.target }
    val inputs = remember(shown?.fields?.id) { ShareFormInputs() }
    CompositionLocalProvider(LocalShareFormInputs provides inputs) {
        ShareMorphDialog(
            morph,
            current?.fields?.target,
            ability?.title ?: "Характеристика",
            current?.saving != true,
            close,
            editor = {
                val focus = androidx.compose.ui.platform.LocalFocusManager.current
                val keyboard = androidx.compose.ui.platform.LocalSoftwareKeyboardController.current
                val dismiss = {
                    focus.clearFocus()
                    keyboard?.hide()
                    close()
                }
                if (shown != null && ability != null)
                    Column(
                        Modifier.fillMaxWidth().padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(18.dp),
                    ) {
                        Text(ability.title, style = ShareTypography.header)
                        val mechanics =
                            remember(shown.baseline, items, metadata) {
                                DndDerivedValues(shown.baseline, items, metadata)
                            }
                        StatFormFields(
                            FeatureFormScope(shown, input, readInput),
                            number,
                            mechanics,
                            metadata,
                        )
                        shown.fields.error?.let {
                            Text(it, color = WebPalette.Danger, style = ShareTypography.context)
                        }
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
                        ) {
                            ShareTextButton(onClick = dismiss, enabled = !shown.saving) {
                                Text("Отмена")
                            }
                            ShareButton(
                                onClick = {
                                    focus.clearFocus()
                                    keyboard?.hide()
                                    inputs.flush()
                                    submit()
                                },
                                enabled = !shown.saving,
                            ) {
                                Text(if (shown.saving) "Сохраняем…" else "Сохранить")
                            }
                        }
                    }
            },
        )
    }
}
