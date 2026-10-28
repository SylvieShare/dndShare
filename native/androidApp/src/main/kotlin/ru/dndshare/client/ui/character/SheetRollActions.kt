package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.dndshare.client.character.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SheetRollActions(
    open: Boolean,
    close: () -> Unit,
    request: SheetRollRequest,
    editTarget: String?,
) {
    val context = LocalCharacterSheet.current
    var advantage by remember { mutableStateOf(false) }
    var disadvantage by remember { mutableStateOf(false) }
    LaunchedEffect(open) {
        if (open) {
            val modes =
                if (request.manualMode == "auto") rollEffects(context.mechanics, request).first
                else listOf(request.manualMode)
            advantage = "advantage" in modes
            disadvantage = "disadvantage" in modes
        }
    }
    ShareDropdownMenu(open, close) {
        Row(
            Modifier.padding(horizontal = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            ShareChoiceChip(
                disadvantage,
                { disadvantage = !disadvantage },
                label = { Text("Помеха") },
            )
            ShareChoiceChip(advantage, { advantage = !advantage }, label = { Text("Преимущество") })
        }
        ShareDropdownMenuItem(
            text = { Text("Бросить кубик") },
            onClick = {
                close()
                context.roll(
                    request.copy(
                        manualMode =
                            if (advantage == disadvantage) "normal"
                            else if (advantage) "advantage" else "disadvantage"
                    )
                )
            },
        )
        if (context.canEdit && editTarget != null)
            ShareDropdownMenuItem(
                text = { Text("Изменить") },
                onClick = {
                    close()
                    context.edit(editTarget)
                },
            )
    }
}
