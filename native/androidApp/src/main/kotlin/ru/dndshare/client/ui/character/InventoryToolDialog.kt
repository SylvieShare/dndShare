package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun InventoryToolDialog(uid: String, close: () -> Unit) {
    val context = LocalCharacterSheet.current
    val entry = inventoryEntry(context.sheet.values["items"].objectValue(), uid)
    ShareFormDialog(
        entry?.let { inventoryEntryName(it, context.items) } ?: "Проверка инструментом",
        close,
    ) {
        Text("Выберите характеристику", style = ShareTypography.group)
        dndAbilities.forEach { ability ->
            val request = runCatching {
                toolRollRequest(
                    context.sheet,
                    uid,
                    ability.suggestId,
                    context.items,
                    context.metadata,
                )
            }.getOrNull()
            if (request != null) {
                val mode = automaticRollMode("auto", rollEffects(context.mechanics, request).first)
                TextButton(
                    onClick = {
                        close()
                        context.roll(request)
                    },
                    enabled = !context.rollBusy,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(ability.title, Modifier.weight(1f))
                    Text(signed(request.bonus))
                    if (mode != "normal")
                        Text(if (mode == "advantage") " · преимущество" else " · помеха")
                }
            }
        }
        if (entry == null)
            Text(
                "Инструмент был удалён или перемещён.",
                style = ShareTypography.context,
                color = WebPalette.TextMuted,
            )
    }
}
