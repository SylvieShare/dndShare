package ru.dndshare.client.ui.character

import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
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
    ) {
        if (dnd != null) DndHeaderTools(
            stacked = session != null && format == LayoutFormat.Phone,
            canRest = dnd.canEdit, rest = { dnd.edit("rest") }, settings = { dnd.edit("menu") },
        )
        if (session != null) {
            val connection = if (ui.campaign.sessionUuid == session.uuid) ui.campaign.connection else SessionConnection.Connecting
            SheetSessionBadge(session.name, connection, ui.campaign.players.size, ui.campaign.transfers.size + ui.campaign.pending.size,
                session = { model.edit("campaign") }, players = { model.edit("campaign:players") }, events = { model.edit("campaign:events") })
        }
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
internal fun DndHeaderTools(stacked: Boolean, canRest: Boolean, rest: () -> Unit, settings: () -> Unit) {
    val buttons: @Composable () -> Unit = {
        IconButton(rest, Modifier.size(36.dp).semantics { contentDescription = "Отдых и рассвет" }, enabled = canRest) {
            AppGlyph(Glyph.Rest, Modifier.size(18.dp), WebPalette.TextSecondary)
        }
        IconButton(settings, Modifier.size(36.dp).semantics { contentDescription = "Меню персонажа" }) {
            AppGlyph(Glyph.Settings, Modifier.size(18.dp), WebPalette.TextSecondary)
        }
    }
    if (stacked) Column { buttons() } else Row { buttons() }
}

@Composable
internal fun SheetSessionBadge(name: String, connection: SessionConnection, playerCount: Int, eventCount: Int,
    session: () -> Unit, players: () -> Unit, events: () -> Unit) {
    Column(Modifier.width(100.dp).background(WebPalette.Surface, RoundedCornerShape(DesignTokens.Radius.Tile))
        .padding(horizontal = 6.dp, vertical = 2.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            SessionHeaderAction(Glyph.Characters, "Игроки", playerCount, players)
            SessionHeaderAction(Glyph.Bell, "События", eventCount, events)
        }
        Row(Modifier.heightIn(min = 22.dp).clickable(onClick = session), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            val tint = when (connection) {
                SessionConnection.Connected -> WebPalette.Success
                SessionConnection.Connecting -> WebPalette.Info
                SessionConnection.Offline -> WebPalette.Danger
            }
            Spacer(Modifier.size(6.dp).background(tint, CircleShape).semantics { contentDescription = connection.label })
            Text(name, style = ShareTypography.context, color = WebPalette.TextSecondary,
                maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun SessionHeaderAction(icon: Glyph, label: String, count: Int, click: () -> Unit) {
    Box(Modifier.size(36.dp, 34.dp), contentAlignment = Alignment.Center) {
        IconButton(
            click,
            Modifier.size(36.dp, 34.dp).semantics { contentDescription = "$label: $count" },
        ) {
            AppGlyph(icon, Modifier.size(18.dp))
        }
        Text(
            count.toString(),
            Modifier.align(Alignment.BottomEnd),
            style = ShareTypography.context,
            color = WebPalette.AccentSoft,
        )
    }
}
