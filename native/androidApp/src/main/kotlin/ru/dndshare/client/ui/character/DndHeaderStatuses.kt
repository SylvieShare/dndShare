package ru.dndshare.client.ui.character

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.CatalogueItem
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

internal fun hasHeaderStatuses(ctx: SheetContext): Boolean =
    ctx.sheet.values["states"].arrayValue().isNotEmpty() ||
        ctx.sheet.values["exhaustion"].objectValue()["level"].number() > 0 ||
        ctx.sheet.values["inspiration"] == JsonPrimitive(true)

private data class HeaderStatus(val uid: String, val title: String, val item: CatalogueItem?)

@Composable
internal fun DndSummaryStrip() {
    val ctx = LocalCharacterSheet.current
    val values = ctx.sheet.values
    val states = values["states"].arrayValue().mapIndexed { index, raw ->
        val row = raw.objectValue()
        val id = row["effect_id"].referenceId()
        val item = ctx.items[id]
        HeaderStatus(row.text("uid").ifBlank { "status-$id-$index" }, item?.name ?: row.label().ifBlank { "Состояние" }, item)
    }.toMutableList()
    val exhaustion = values["exhaustion"].objectValue()["level"].number()
    if (exhaustion > 0) states.add(HeaderStatus("exhaustion", "Истощение $exhaustion", null))
    if (values["inspiration"] == JsonPrimitive(true)) states.add(HeaderStatus("inspiration", "Вдохновение", null))
    if (states.isEmpty()) return
    var mechanics by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    var error by remember { mutableStateOf<String?>(null) }
    Column {
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                .padding(horizontal = DesignTokens.Spacing.Page, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            for (state in states) key(state.uid) {
                val mechanic = statusMechanic(ctx.sheet, ctx.items, state.uid)
                val actions = buildList {
                    state.item?.let { item -> add(ShareMenuAction("Посмотреть", Glyph.Eye, { ctx.openItem(item.id) })) }
                    if (mechanic != null && (mechanic.ongoing != null || mechanic.repeat != null || mechanic.effect.data["weapon_target"] is JsonObject))
                        add(ShareMenuAction("Действия эффекта", Glyph.Sparkles, { mechanics = state.uid }, enabled = ctx.canEdit))
                    add(ShareMenuAction("Изменить состояние", Glyph.Edit, { ctx.edit("statuses") }, enabled = ctx.canEdit))
                    add(ShareMenuAction("Убрать", Glyph.Trash, {
                        scope.launch { error = ctx.itemMechanic(state.uid, "status-remove", JsonObject(emptyMap())) }
                    }, enabled = ctx.canEdit, danger = true))
                }
                ShareActionMenu(
                    "Действия: " + state.title,
                    actions,
                    ownerKey = state.uid,
                    trigger = { modifier, open, _ ->
                        Row(
                            modifier.heightIn(min = 32.dp).clickable(onClick = open)
                                .semantics { contentDescription = state.title },
                            horizontalArrangement = Arrangement.spacedBy(5.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            val icon = state.item?.iconImageUrl ?: state.item?.svg
                            if (icon != null) AsyncImage(icon, null, ctx.images, modifier = Modifier.size(20.dp))
                            else AppGlyph(Glyph.Sparkles, Modifier.size(16.dp), WebPalette.AccentSoft)
                            Text(state.title, style = ShareTypography.context, color = WebPalette.AccentSoft)
                        }
                    },
                )
            }
        }
        error?.let { Text(it, color = WebPalette.Danger, style = ShareTypography.context) }
    }
    mechanics?.let { uid ->
        statusMechanic(ctx.sheet, ctx.items, uid)?.let { status ->
            StatusMechanicDialog(status) { mechanics = null }
        }
    }
}
