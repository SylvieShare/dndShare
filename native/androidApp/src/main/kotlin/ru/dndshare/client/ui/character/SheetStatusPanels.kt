package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SheetStatusPanels(
    ui: CharacterSheetUiState,
    model: CharacterSheetViewModel,
    readOnly: Boolean,
) {
    if (readOnly)
        Text(
            "Режим просмотра",
            Modifier.padding(horizontal = 20.dp, vertical = 4.dp),
            style = ShareTypography.context,
            color = WebPalette.TextSecondary,
        )
    if (ui.snapshot?.draft?.edits?.isNotEmpty() == true) {
        SheetSaveStatus(
            ui.snapshot.draft.blocked ?: ui.saveMessage,
            model::retrySave,
            reload = { model.confirmReload(true) },
        )
    }
    if (ui.commands.pending || ui.commands.message != null)
        Surface(color = WebPalette.Raised) {
            Row(
                Modifier.fillMaxWidth().padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    ui.commands.message ?: "Отправляем действие…",
                    Modifier.weight(1f),
                    style = ShareTypography.context,
                )
                if (!ui.commands.busy && ui.commands.pending)
                    ShareTextButton(onClick = model::retryCommand) {
                        Text("Повторить")
                    }
            }
        }
    ui.loadError?.let { message ->
        Surface(color = WebPalette.Raised) {
            Row(
                Modifier.fillMaxWidth().padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    message,
                    Modifier.weight(1f),
                    style = ShareTypography.context,
                )
                ShareTextButton(onClick = model::refresh) {
                    Text("Повторить")
                }
            }
        }
    }
}

@Composable
private fun SheetSaveStatus(message: String?, retry: () -> Unit, reload: () -> Unit) {
    Surface(color = WebPalette.Raised) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                message ?: "Сохраняем изменения…",
                Modifier.weight(1f),
                style = ShareTypography.context,
                color = if (message != null) WebPalette.Warning else WebPalette.TextSecondary,
            )
            if (message != null) {
                ShareTextButton(onClick = retry) { Text("Повторить") }
                ShareTextButton(onClick = reload) { Text("Версия сервера") }
            }
        }
    }
}
