package ru.dndshare.client.ui.character

import androidx.compose.material3.Text
import androidx.compose.runtime.*
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun WeaponDeleteDialog(entry: JsonObject, title: String, close: () -> Unit) {
    val context = LocalCharacterSheet.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    ShareAlertDialog(
        onDismissRequest = { if (!busy) close() },
        title = { Text("Удалить оружие?") },
        text = {
            Text("«$title» будет удалено из листа вместе с настройкой и зарядами этого экземпляра.")
            error?.let { Text(it, color = WebPalette.Danger) }
        },
        confirmButton = {
            ShareTextButton(
                onClick = {
                    if (!busy) {
                        busy = true
                        scope.launch {
                            try {
                                error =
                                    context.itemMechanic(
                                        entry["uid"]?.jsonPrimitive?.content.orEmpty(),
                                        "weapon-delete",
                                        JsonObject(emptyMap()),
                                    )
                                if (error == null) close()
                            } finally {
                                busy = false
                            }
                        }
                    }
                },
                enabled = !busy,
            ) {
                Text("Удалить", color = WebPalette.Danger)
            }
        },
        dismissButton = {
            ShareTextButton({ if (!busy) close() }, enabled = !busy) { Text("Отмена") }
        },
    )
}
