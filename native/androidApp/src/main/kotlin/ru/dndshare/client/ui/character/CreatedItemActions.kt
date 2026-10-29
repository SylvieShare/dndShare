package ru.dndshare.client.ui.character

import androidx.compose.material3.*
import androidx.compose.runtime.*
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun createdItemActions(entry: JsonObject): List<ShareMenuAction> =
    key(entry.text("uid")) { createdItemActionsForEntry(entry) }

@Composable
private fun createdItemActionsForEntry(entry: JsonObject): List<ShareMenuAction> {
    val context = LocalCharacterSheet.current
    val creation = entry["params"].objectValue()["creation"] as? JsonObject ?: return emptyList()
    if (!context.canEdit || creation["duration"].objectValue().text("kind") == "permanent")
        return emptyList()
    val scope = rememberCoroutineScope()
    var confirming by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    fun expire() {
        if (busy) return
        busy = true
        confirming = false
        scope.launch {
            try {
                error =
                    context.itemMechanic(
                        entry.text("uid"),
                        "created-expire",
                        JsonObject(emptyMap()),
                    )
            } finally {
                busy = false
            }
        }
    }
    if (confirming)
        ShareAlertDialog(
            onDismissRequest = { confirming = false },
            title = { Text("Срок действия закончился?") },
            text = {
                Text(
                    "Остаток этой стопки (${entry["count"].number(1)} шт.) исчезнет из инвентаря. Отмечайте это по игровому времени."
                )
            },
            confirmButton = {
                ShareTextButton(onClick = { expire() }) { Text("Предметы исчезли") }
            },
            dismissButton = {
                ShareTextButton(onClick = { confirming = false }) { Text("Отмена") }
            },
        )
    error?.let { message ->
        ShareAlertDialog(
            onDismissRequest = { error = null },
            title = { Text("Не удалось изменить предмет") },
            text = { Text(message) },
            confirmButton = { ShareTextButton(onClick = { error = null }) { Text("Закрыть") } },
        )
    }
    return listOf(
        ShareMenuAction(
            if (creation["expired"] == JsonPrimitive(true)) "Вернуть срок действия"
            else "Отметить окончание срока",
            Glyph.Refresh,
            { if (creation.text("on_expire") == "vanish") confirming = true else expire() },
            enabled = !busy,
        )
    )
}
