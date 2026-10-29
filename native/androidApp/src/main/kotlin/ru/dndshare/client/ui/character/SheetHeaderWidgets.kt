package ru.dndshare.client.ui.character

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import ru.dndshare.client.ui.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SheetHeaderWidgets(
    ui: CharacterSheetUiState,
    model: CharacterSheetViewModel,
    format: LayoutFormat,
) {
    val session = ui.remote.sessions.firstOrNull { it.uuid == ui.remote.sessionUuid }
    val app = LocalHeaderConnection.current
    val appRetry = LocalHeaderRetry.current
    val blocked = ui.snapshot?.draft?.blocked
    val error =
        blocked
            ?: ui.saveMessage
            ?: ui.commands.message
            ?: ui.loadError
            ?: ui.campaign.error
            ?: app.error
    val busy =
        app.busy ||
            ui.commands.pending ||
            ui.snapshot == null && error == null ||
            ui.snapshot?.draft?.let { it.edits.isNotEmpty() || it.sending != null } == true
    Row(
        Modifier.widthIn(max = if (format == LayoutFormat.Phone) 202.dp else 440.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (session != null) {
            Row(
                Modifier.weight(1f, fill = false)
                    .heightIn(min = 48.dp)
                    .clickable { model.edit("campaign") }
                    .padding(horizontal = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                AppGlyph(Glyph.Sessions, Modifier.size(20.dp), WebPalette.TextMuted)
                Column(Modifier.weight(1f, fill = false)) {
                    Text(
                        session.name,
                        style = ShareTypography.context,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (format != LayoutFormat.Phone)
                        Text(
                            listOfNotNull(session.chapterNumber, session.chapterName)
                                .joinToString(" · ")
                                .ifBlank { "Игровая сессия" },
                            style = ShareTypography.context,
                            color = WebPalette.TextMuted,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                }
            }
            SessionHeaderAction(Glyph.Characters, "Игроки", ui.campaign.players.size) {
                model.edit("campaign:players")
            }
            SessionHeaderAction(
                Glyph.Bell,
                "События",
                ui.campaign.transfers.size + ui.campaign.pending.size,
            ) {
                model.edit("campaign:events")
            }
        }
        HeaderConnectionWidget(
            HeaderConnectionState(
                busy,
                error,
                if (app.busy) app.message else "Сохраняем изменения…",
            ),
            retry = {
                model.retrySave()
                model.refresh()
                model.campaign.refresh()
                model.retryCommand()
                appRetry()
            },
            reload = if (error != null) ({ model.confirmReload(true) }) else null,
        )
    }
}

@Composable
private fun SessionHeaderAction(icon: Glyph, label: String, count: Int, click: () -> Unit) {
    Box(Modifier.size(40.dp), contentAlignment = Alignment.Center) {
        IconButton(
            click,
            Modifier.size(40.dp).semantics { contentDescription = "$label: $count" },
        ) {
            AppGlyph(icon, Modifier.size(20.dp))
        }
        Text(
            count.toString(),
            Modifier.align(Alignment.BottomEnd),
            style = ShareTypography.context,
            color = WebPalette.AccentSoft,
        )
    }
}
