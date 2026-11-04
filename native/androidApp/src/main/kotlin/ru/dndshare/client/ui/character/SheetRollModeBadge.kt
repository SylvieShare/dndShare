package ru.dndshare.client.ui.character

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import ru.dndshare.client.character.DndDerivedValues
import ru.dndshare.client.character.SheetRollRequest
import ru.dndshare.client.character.resolveSheetRollMode
import ru.dndshare.client.ui.designsystem.ShareBadge
import ru.dndshare.client.ui.designsystem.WebPalette

@Composable
internal fun SheetRollModeBadge(mechanics: DndDerivedValues, request: SheetRollRequest) {
    val result = remember(mechanics, request) { resolveSheetRollMode(mechanics, request) }
    val (text, label, color) = when {
        result.cancelled -> Triple("ОБЫЧ.", "Обычный бросок · Преимущество и помеха взаимно отменяются", WebPalette.TextMuted)
        result.mode == "advantage" -> Triple("ПРЕИМ.", "Преимущество", WebPalette.Success)
        result.mode == "disadvantage" -> Triple("ПОМ.", "Помеха", WebPalette.Danger)
        else -> return
    }
    ShareBadge(
        text,
        modifier = Modifier.clearAndSetSemantics {
            contentDescription = (listOf(label) + result.sources).joinToString(" · ")
        },
        color = color,
        compact = true,
    )
}
