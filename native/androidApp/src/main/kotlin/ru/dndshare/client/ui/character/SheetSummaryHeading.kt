package ru.dndshare.client.ui.character

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SheetSummaryHeading(
    title: String,
    actions: List<ShareMenuAction> = emptyList(),
    divider: Boolean = false,
) {
    val face: @Composable (Modifier) -> Unit = { modifier ->
        Row(
            modifier,
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                title.uppercase(),
                style =
                    ShareTypography.context.copy(
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = .5.sp,
                    ),
                color = WebPalette.TextMuted,
            )
            if (actions.isNotEmpty())
                AppGlyph(Glyph.Edit, Modifier.size(12.dp), WebPalette.TextMuted)
            if (divider) androidx.compose.material3.HorizontalDivider(Modifier.weight(1f))
        }
    }
    if (actions.isEmpty()) face(Modifier)
    else
        ShareActionMenu(
            "Настроить: $title",
            actions,
            trigger = { modifier, open ->
                face(modifier.fillMaxWidth().clickable(onClick = open))
            },
        )
}
