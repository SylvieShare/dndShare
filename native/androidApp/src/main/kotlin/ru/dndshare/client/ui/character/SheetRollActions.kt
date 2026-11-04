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
    var mode by remember { mutableStateOf("normal") }
    LaunchedEffect(open) {
        if (open) {
            val modes =
                if (request.manualMode == "auto") rollEffects(context.mechanics, request).first
                else emptyList()
            mode = automaticRollMode(request.manualMode, modes)
        }
    }
    ShareDropdownMenu(open, close, Modifier.width(DesignTokens.Layout.RollModeMenuWidth)) {
        SheetRollModePicker(mode, { mode = it }, enabled = open)
        ShareDropdownMenuItem(
            text = { Text("Бросить кубик") },
            leadingIcon = { AppGlyph(Glyph.Dice, Modifier.size(18.dp)) },
            onClick = {
                close()
                context.roll(request.copy(manualMode = mode))
            },
        )
        if (context.canEdit && editTarget != null)
            ShareDropdownMenuItem(
                text = { Text("Изменить") },
                leadingIcon = { AppGlyph(Glyph.Edit, Modifier.size(18.dp)) },
                onClick = {
                    close()
                    context.edit(editTarget)
                },
            )
    }
}
