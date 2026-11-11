package ru.dndshare.client.ui.character

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SheetSessionMenu(
    name: String, connection: SessionConnection, playerCount: Int, eventCount: Int,
    session: () -> Unit, players: () -> Unit, events: () -> Unit,
    incomingCount: Int = 0,
) {
    var expanded by remember(name) { mutableStateOf(false) }
    val tint = when (connection) {
        SessionConnection.Connected -> WebPalette.Success
        SessionConnection.Connecting -> WebPalette.Info
        SessionConnection.Offline -> WebPalette.Danger
    }
    Box {
        IconButton({ expanded = !expanded }, Modifier.size(DesignTokens.Layout.TouchMin)
            .semantics { contentDescription = "Сессия" }) {
            Box {
                AppGlyph(Glyph.Sessions, Modifier.size(DesignTokens.Layout.SheetHeaderActionIcon), WebPalette.TextSecondary)
                Spacer(Modifier.align(Alignment.BottomEnd).offset(3.dp, 2.dp).size(7.dp)
                    .background(tint, CircleShape).semantics { contentDescription = connection.label })
                if (eventCount > 0) Text(if (eventCount > 99) "99+" else eventCount.toString(),
                    Modifier.align(Alignment.TopEnd).offset(10.dp, (-8).dp)
                        .background(if (incomingCount > 0) WebPalette.Warning else WebPalette.Surface, CircleShape).padding(horizontal = 3.dp),
                    color = if (incomingCount > 0) WebPalette.Background else WebPalette.AccentSoft, style = ShareTypography.context)
            }
        }
        ShareDropdownMenu(expanded, { expanded = false }) {
            Text(name, Modifier.padding(10.dp), style = ShareTypography.group, color = WebPalette.Text)
            Text(connection.label, Modifier.padding(horizontal = 10.dp, vertical = 2.dp),
                style = ShareTypography.context, color = tint)
            ShareDropdownMenuItem({ Text("Открыть сессию") }, { expanded = false; session() },
                leadingIcon = { AppGlyph(Glyph.Sessions) })
            ShareDropdownMenuItem({ Text("Игроки") }, { expanded = false; players() },
                leadingIcon = { AppGlyph(Glyph.Characters) }, trailingIcon = { Text(playerCount.toString()) })
            ShareDropdownMenuItem({ Text("События") }, { expanded = false; events() },
                leadingIcon = { AppGlyph(Glyph.Bell) }, trailingIcon = { Text(eventCount.toString()) })
        }
    }
}
