package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.text.DecimalFormat
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

private data class InventoryPreview(val base: JsonObject, val value: JsonObject)

@Composable
internal fun DndInventory() {
    val uuid = LocalCharacterSheet.current.uuid
    key(uuid) { InventoryContent() }
}

@Composable
private fun InventoryContent() {
    val context = LocalCharacterSheet.current
    val raw = context.sheet.values["items"].objectValue()
    var preview by remember(context.uuid) { mutableStateOf<InventoryPreview?>(null) }
    val model = remember(raw, preview) { normalizeInventorySpaces(preview?.value ?: raw) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var tool by rememberSaveable(context.uuid) { mutableStateOf<String?>(null) }
    var details by rememberSaveable(context.uuid) { mutableStateOf<String?>(null) }
    var deleting by rememberSaveable(context.uuid) { mutableStateOf<String?>(null) }
    var deletingSpace by rememberSaveable(context.uuid) { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(raw) { if (preview?.base != raw) preview = null }
    fun perform(uid: String, operation: String, input: JsonObject) {
        if (busy || !context.canEdit) return
        val next = runCatching {
            inventoryActionPatches(context.sheet, uid, operation, input, context.items)
                .firstOrNull()
                ?.value
                ?.objectValue()
        }
            .getOrElse {
                error = it.message
                return
            }
        if (next == null) return
        preview = InventoryPreview(raw, next)
        busy = true
        error = null
        scope.launch(start = CoroutineStart.UNDISPATCHED) {
            try {
                val failure = context.itemMechanic(uid, operation, input)
                if (failure != null) {
                    preview = null
                    error = failure
                }
            } finally {
                busy = false
            }
        }
    }
    val phone =
        androidx.compose.ui.platform.LocalWindowInfo.current.containerDpSize.width <
            DesignTokens.Layout.Tablet
    val blocked = busy || preview != null
    Column(
        Modifier.padding(
            horizontal = if (phone) 14.dp else 18.dp,
            vertical = if (phone) 14.dp else 16.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        InventoryWallet()
        if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        error?.let { Text(it, style = ShareTypography.context, color = WebPalette.Danger) }
        InventoryGrid(
            model,
            blocked,
            ::perform,
            { details = it },
            { tool = it },
            { deleting = it },
            { deletingSpace = it },
        )
        if (context.canEdit)
            Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ShareDashedAction(
                    "+ Добавить секцию",
                    { context.edit("inventory-section:new") },
                    modifier = Modifier.weight(1f),
                    compact = true,
                    enabled = !blocked,
                )
            }
    }
    tool?.let { uid -> InventoryToolDialog(uid, { tool = null }) }
    details?.let { uid ->
        val entry = inventoryEntry(model, uid)
        ShareFormDialog(
            entry?.let { inventoryEntryName(it, context.items) } ?: "Предмет недоступен",
            { details = null },
        ) {
            if (entry != null) {
                val local =
                    context.copy(
                        edit = {
                            details = null
                            context.edit(it)
                        },
                        openItem = {
                            details = null
                            context.openItem(it)
                        },
                    )
                CompositionLocalProvider(LocalCharacterSheet provides local) {
                    val economy =
                        inventoryItemEconomy(resolveInventoryItem(entry, context.items), entry)
                    Text("Количество: ${entry["count"].number(1)}", style = ShareTypography.group)
                    economy.weight?.let {
                        Text(
                            "Вес: ${DecimalFormat("0.########").format(it)} фунт.",
                            style = ShareTypography.context,
                        )
                    }
                    val item = resolveInventoryItem(entry, context.items)
                    val description =
                        entry["override"].objectValue().text("desc").ifBlank {
                            item?.data?.text("desc").orEmpty().ifBlank {
                                item?.data?.text("description").orEmpty()
                            }
                        }
                    if (description.isNotBlank()) SheetDescription(description)
                    ItemMechanicsPanels(entry)
                    val created = createdItemActions(entry)
                    if (created.isNotEmpty())
                        ShareActionMenu("Срок действия предмета", created, ownerKey = uid)
                    if (context.canEdit)
                        ShareAction("Изменить", { local.edit("inventory:$uid") }, icon = Glyph.Edit)
                    (entry["magic_item_id"] ?: entry["item_id"]).referenceId()?.let { id ->
                        TextButton(onClick = { local.openItem(id) }) { Text("Открыть справочник") }
                    }
                }
            } else Text("Предмет был удалён или перемещён.", style = ShareTypography.context)
        }
    }
    deletingSpace?.let { id ->
        val section =
            model["sections"]
                .arrayValue()
                .map { it.objectValue() }
                .firstOrNull { it.text("id") == id }
        AlertDialog(
            onDismissRequest = { deletingSpace = null },
            title = { Text("Удалить секцию?") },
            text = {
                Text("Секция «${section?.text("name").orEmpty()}» и все её предметы будут удалены.")
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        deletingSpace = null
                        perform(id, "inventory-section-delete", JsonObject(emptyMap()))
                    },
                    enabled = section != null && !blocked,
                ) {
                    Text("Удалить", color = WebPalette.Danger)
                }
            },
            dismissButton = { TextButton(onClick = { deletingSpace = null }) { Text("Отмена") } },
        )
    }
    deleting?.let { uid ->
        val entry = inventoryEntry(model, uid)
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Удалить предмет?") },
            text = {
                Text(
                    entry?.let {
                        "${inventoryEntryName(it,context.items)} · ${it["count"].number(1)} шт."
                    } ?: "Предмет больше недоступен."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        deleting = null
                        perform(uid, "inventory-delete", JsonObject(emptyMap()))
                    },
                    enabled = entry != null && !busy,
                ) {
                    Text("Удалить", color = WebPalette.Danger)
                }
            },
            dismissButton = { TextButton(onClick = { deleting = null }) { Text("Отмена") } },
        )
    }
}
