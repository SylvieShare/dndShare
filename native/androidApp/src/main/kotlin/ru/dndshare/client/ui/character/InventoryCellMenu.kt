package ru.dndshare.client.ui.character

import androidx.compose.runtime.Composable
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun inventoryCellActions(
    context: SheetContext,
    model: JsonObject,
    entry: JsonObject,
    spaceId: String,
    busy: Boolean,
    perform: (String, String, JsonObject) -> Unit,
    properties: (String) -> Unit,
    tool: (String) -> Unit,
    remove: (String) -> Unit,
): List<ShareMenuAction> {
    val created = createdItemActions(entry)
    return buildList {
        val uid = entry.text("uid")
        val item = resolveInventoryItem(entry, context.items)
        val worn = model["equipped"].arrayValue().any { it.objectValue().text("uid") == uid }
        add(ShareMenuAction("Свойства", { properties(uid) }))
        addAll(created)
        if (context.canEdit) {
            if (item?.typeId == 14L)
                add(ShareMenuAction("Проверка инструментом", { tool(uid) }, !busy))
            add(ShareMenuAction("Изменить", { context.edit("inventory:$uid") }, !busy))
            if (worn || canEquipInventoryItem(item))
                add(
                    ShareMenuAction(
                        if (worn) "Снять" else "Экипировать",
                        { perform(uid, "inventory-equip", JsonObject(emptyMap())) },
                        !busy,
                    )
                )
            if (
                item?.data?.get("usable") is JsonObject &&
                    entry["params"].objectValue()["creation"].objectValue()["expired"] !=
                        JsonPrimitive(true)
            )
                add(
                    ShareMenuAction(
                        "Использовать на себе",
                        { context.edit("item-use:items|$uid") },
                        !busy,
                    )
                )
            add(
                ShareMenuAction(
                    "Добавить 1",
                    { perform(uid, "inventory-count", buildJsonObject { put("delta", 1) }) },
                    !busy,
                )
            )
            add(
                ShareMenuAction(
                    "Убрать 1",
                    {
                        if (entry["count"].number(1) == 1) remove(uid)
                        else perform(uid, "inventory-count", buildJsonObject { put("delta", -1) })
                    },
                    !busy,
                )
            )
            for (raw in model["sections"].arrayValue()) {
                val space = raw.objectValue()
                if (space.text("id") != spaceId)
                    add(
                        ShareMenuAction(
                            "Переместить: ${space.text("name")}",
                            {
                                perform(
                                    uid,
                                    "inventory-move",
                                    buildJsonObject {
                                        put("fromId", spaceId)
                                        put("toId", space.text("id"))
                                    },
                                )
                            },
                            !busy,
                        )
                    )
            }
            if (item?.typeId == 1L || item?.typeId == 19L && item.data["weapon"] is JsonObject)
                add(ShareMenuAction("Переместить в оружие", { context.edit("weapon:$uid") }, !busy))
            if (context.sessionUuid != null)
                add(ShareMenuAction("Передать", { context.edit("transfer:items|$uid") }, !busy))
            add(ShareMenuAction("Удалить", { remove(uid) }, !busy, danger = true))
        }
        val id = (entry["magic_item_id"] ?: entry["item_id"]).referenceId()
        if (id != null) add(ShareMenuAction("Справочник", { context.openItem(id) }))
    }
}
