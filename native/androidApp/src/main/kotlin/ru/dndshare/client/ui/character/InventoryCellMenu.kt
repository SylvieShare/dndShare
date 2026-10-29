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
        add(ShareMenuAction("Свойства", Glyph.InfoCircle, { properties(uid) }))
        addAll(created)
        if (context.canEdit) {
            if (item?.typeId == 14L)
                add(ShareMenuAction("Проверка инструментом", Glyph.Dice, { tool(uid) }, !busy))
            add(ShareMenuAction("Изменить", Glyph.Edit, { context.edit("inventory:$uid") }, !busy))
            if (worn || canEquipInventoryItem(item))
                add(
                    ShareMenuAction(
                        if (worn) "Снять" else "Экипировать",
                        Glyph.Shirt,
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
                        Glyph.Account,
                        { context.edit("item-use:items|$uid") },
                        !busy,
                    )
                )
            add(
                ShareMenuAction(
                    "Добавить 1",
                    Glyph.Plus,
                    { perform(uid, "inventory-count", buildJsonObject { put("delta", 1) }) },
                    !busy,
                )
            )
            add(
                ShareMenuAction(
                    "Убрать 1",
                    Glyph.Minus,
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
                            Glyph.Move,
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
                add(
                    ShareMenuAction(
                        "Переместить в оружие",
                        Glyph.Swords,
                        { context.edit("weapon:$uid") },
                        !busy,
                    )
                )
            if (context.sessionUuid != null)
                add(
                    ShareMenuAction(
                        "Передать",
                        Glyph.Transfer,
                        { context.edit("transfer:items|$uid") },
                        !busy,
                    )
                )
            add(ShareMenuAction("Удалить", Glyph.Trash, { remove(uid) }, !busy, danger = true))
        }
        val id = (entry["magic_item_id"] ?: entry["item_id"]).referenceId()
        if (id != null) add(ShareMenuAction("Справочник", Glyph.Book, { context.openItem(id) }))
    }
}
