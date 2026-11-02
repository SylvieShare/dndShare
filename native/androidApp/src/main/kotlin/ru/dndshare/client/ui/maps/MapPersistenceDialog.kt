package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import ru.dndshare.client.maps.MapEditorState
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapPersistenceDialog(
    state: MapEditorState,
    dismiss: () -> Unit,
    library: () -> Unit,
    retry: () -> Unit,
    reload: () -> Unit,
    saveCopy: () -> Unit,
) {
    var confirmReload by remember { mutableStateOf(false) }
    if (confirmReload)
        ShareAlertDialog(
            onDismissRequest = { confirmReload = false },
            title = { Text("Загрузить карту с сервера?") },
            text = {
                Text(
                    "Локальные правки этой карты будут удалены. Сначала можно сохранить их отдельной копией."
                )
            },
            confirmButton = {
                ShareTextButton(
                    {
                        reload()
                        dismiss()
                    },
                    enabled = !state.saving,
                ) {
                    Text("Загрузить")
                }
            },
            dismissButton = { ShareTextButton({ confirmReload = false }) { Text("Отмена") } },
        )
    else
        ShareAlertDialog(
            onDismissRequest = { if (!state.saving) dismiss() },
            title = {
                Text(
                    if (state.conflict) "Не удалось сохранить эту карту"
                    else "Остались несохранённые изменения"
                )
            },
            text = {
                Text(
                    "Сервер ещё не принял изменения. Можно повторить сохранение, остаться в редакторе или вернуться к картам."
                )
            },
            confirmButton = {
                Column {
                    if (state.conflict) {
                        ShareButton(saveCopy, enabled = !state.saving) {
                            Text("Сохранить локальную копию")
                        }
                        ShareTextButton({ confirmReload = true }, enabled = !state.saving) {
                            Text("Загрузить с сервера")
                        }
                    } else
                        ShareButton(retry, enabled = !state.saving) { Text("Повторить сохранение") }
                    ShareTextButton(library, enabled = !state.saving) { Text("В библиотеку") }
                }
            },
            dismissButton = {
                ShareTextButton(dismiss, enabled = !state.saving) { Text("Остаться") }
            },
        )
}
