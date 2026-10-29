package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SheetCatalogueEntry(
    reference: JsonElement,
    expanded: Boolean = true,
    editTarget: String? = null,
    displayItem: ru.dndshare.client.model.CatalogueItem? = null,
    extraActions: List<ShareMenuAction> = emptyList(),
    headerActions: @Composable RowScope.() -> Unit = {},
    leading: (@Composable () -> Unit)? = null,
    titleDetails: @Composable ColumnScope.() -> Unit = {},
    titleStyle: androidx.compose.ui.text.TextStyle = ShareTypography.card,
    titleSuffix: @Composable () -> Unit = {},
    contentPadding: PaddingValues = PaddingValues(DesignTokens.Spacing.Large),
    showPreparedBadge: Boolean = true,
    details: @Composable ColumnScope.() -> Unit = {},
) {
    val context = LocalCharacterSheet.current
    val entry = reference.objectValue()
    val creationActions = createdItemActions(entry)
    val id = (entry["magic_item_id"] ?: entry["item_id"] ?: entry["id"])?.jsonPrimitive?.longOrNull
    val item = context.items[id]
    if (
        id != null &&
            item == null &&
            (context.fetchingContent || context.resolvedItemIds?.let { id !in it } == true)
    ) {
        SheetItemSkeleton()
        return
    }
    val display = displayItem ?: item
    val title =
        entry["override"]
            .objectValue()
            .text("name")
            .ifBlank { entry.label() }
            .ifBlank { display?.name ?: "Запись недоступна" }
    fun open() {
        if (id == null) return
        if (item?.typeId == 5L && entry.text("key").isNotBlank() && context.openSpell != null)
            context.openSpell.invoke(entry.text("key"), id)
        else context.openItem(id)
    }
    ShareTile(
        Modifier.fillMaxWidth()
            .semantics { testTagsAsResourceId = true }
            .testTag(
                "sheet-entry:${entry.text("uid").ifBlank {entry.text("key")}.ifBlank {id?.toString().orEmpty()}}"
            ),
        onClick = id?.let { { open() } },
        framed = false,
        contentPadding = contentPadding,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (leading != null) leading()
            else if (display?.iconImageUrl != null)
                AsyncImage(
                    display.iconImageUrl,
                    null,
                    imageLoader = context.images,
                    modifier = Modifier.size(64.dp),
                )
            Column(Modifier.weight(1f)) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(title, style = titleStyle)
                    titleSuffix()
                }
                titleDetails()
                if (id != null && item == null) {
                    Text(
                        "Запись недоступна",
                        style = ShareTypography.context,
                        color = WebPalette.TextMuted,
                    )
                    ShareTextButton(onClick = context.refreshContent) { Text("Повторить загрузку") }
                }
            }
            entry["count"]
                ?.takeIf { "item_id" in entry }
                ?.let {
                    if (it.number() != 1) Text("×${it.number()}", color = WebPalette.AccentSoft)
                }
            if (showPreparedBadge && entry["prepared"] == JsonPrimitive(true))
                ShareBadge("Подготовлено")
            headerActions()
            if (context.canEdit) {
                val source = if (editTarget?.startsWith("weapon:") == true) "weapon" else "items"
                val uid = entry.text("uid")
                val actions = buildList {
                    addAll(extraActions)
                    addAll(creationActions)
                    if (editTarget != null)
                        add(ShareMenuAction("Изменить", { context.edit(editTarget) }))
                    if (item?.typeId == 5L && entry.text("key").isNotBlank()) {
                        add(
                            ShareMenuAction(
                                "Броски заклинания",
                                { context.edit("spell-roll:${entry.text("key")}") },
                            )
                        )
                        add(
                            ShareMenuAction(
                                "Сотворить",
                                { context.edit("spell-cast:${entry.text("key")}") },
                            )
                        )
                    }
                    if (
                        uid.isNotBlank() &&
                            item?.data?.get("usable") is JsonObject &&
                            entry["params"].objectValue()["creation"].objectValue()["expired"] !=
                                JsonPrimitive(true)
                    )
                        add(
                            ShareMenuAction(
                                "Использовать на себе",
                                { context.edit("item-use:$source|$uid") },
                            )
                        )
                    if (uid.isNotBlank() && context.sessionUuid != null)
                        add(ShareMenuAction("Передать", { context.edit("transfer:$source|$uid") }))
                    if (id != null) add(ShareMenuAction("Справочник", { open() }))
                }
                if (actions.isNotEmpty())
                    ShareActionMenu(
                        "Действия с записью: $title",
                        actions,
                        ownerKey =
                            entry.text("uid").ifBlank {
                                entry.text("key").ifBlank { id?.toString().orEmpty() }
                            },
                    )
            }
        }
        if (expanded) {
            val description =
                entry
                    .text("desc")
                    .ifBlank { item?.data?.text("desc").orEmpty() }
                    .ifBlank { item?.data?.text("description").orEmpty() }
            if (description.isNotBlank()) SheetDescription(description)
        }
        details()
        ItemMechanicsPanels(entry)
    }
}

@Composable
internal fun SheetEmpty(label: String) {
    Text(
        label,
        Modifier.padding(vertical = 20.dp),
        style = ShareTypography.group,
        color = WebPalette.TextMuted,
    )
}
