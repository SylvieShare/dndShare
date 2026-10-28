package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun CharacterCampaignBadge() {
    val context = LocalCharacterSheet.current
    if (context.sessionUuid != null)
        ShareTile(framed = false, onClick = { context.edit("campaign") }) {
            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                AppGlyph(Glyph.Sessions)
                Text(
                    context.sessionName.ifBlank { "Сессия" },
                    Modifier.weight(1f),
                    style = ShareTypography.group,
                )
                AppGlyph(Glyph.Chevron)
            }
        }
}
