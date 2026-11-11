package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import ru.dndshare.client.ui.*
import ru.dndshare.client.ui.designsystem.*
import ru.dndshare.client.model.text

@Composable
internal fun SheetHeaderWidgets(
    ui: CharacterSheetUiState,
    model: CharacterSheetViewModel,
    format: LayoutFormat,
    dnd: SheetContext?,
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
            ui.snapshot == null && error == null
    Row(
        Modifier.widthIn(max = if (format == LayoutFormat.Phone) 202.dp else 440.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        if (session != null) {
            val connection = if (ui.campaign.sessionUuid == session.uuid) ui.campaign.connection else SessionConnection.Connecting
            SheetSessionMenu(session.name, connection, ui.campaign.players.size, ui.campaign.transfers.size + ui.campaign.pending.size,
                session = { model.edit("campaign") }, players = { model.edit("campaign:players") }, events = { model.edit("campaign:events") },
                incomingCount = (ui.campaign.transfers + ui.campaign.pending).count { it.text("recipientCharUuid") == dnd?.uuid })
        }
        if (dnd != null) DndHeaderTools(
            canRest = dnd.canEdit, rest = { dnd.edit("rest") }, settings = { dnd.edit("menu") },
        )
        HeaderConnectionWidget(
            HeaderConnectionState(
                busy,
                error,
                if (app.busy) app.message else "Обновляем данные…",
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
internal fun DndHeaderTools(canRest: Boolean, rest: () -> Unit, settings: () -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        IconButton(rest, Modifier.size(DesignTokens.Layout.TouchMin).semantics { contentDescription = "Отдых и рассвет" }, enabled = canRest) {
            AppGlyph(Glyph.Rest, Modifier.size(DesignTokens.Layout.SheetHeaderActionIcon), WebPalette.TextSecondary)
        }
        IconButton(settings, Modifier.size(DesignTokens.Layout.TouchMin).semantics { contentDescription = "Меню персонажа" }) {
            AppGlyph(Glyph.Settings, Modifier.size(DesignTokens.Layout.SheetHeaderActionIcon), WebPalette.TextSecondary)
        }
    }
}
