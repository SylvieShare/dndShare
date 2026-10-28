package ru.dndshare.client.ui.character

import java.util.UUID
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.data.CachedSheetSection
import ru.dndshare.client.model.*

/**
 * Runs under SheetItemMechanicsController's per-sheet mutex. Intent and result enter one outbox
 * edit.
 */
internal suspend fun performConfirmedUse(
    uuid: String,
    uid: String,
    operation: String,
    input: JsonObject,
    sheet: CharacterSheet,
    content: SheetContentState,
    session: String?,
    sheets: CharacterSheetRepository,
) {
    val items = content.items
    val entry =
        inventoryInstances(sheet).firstOrNull { it.first.text("uid") == uid }?.first
            ?: error("Предмет больше не существует.")
    val item = items[(entry["magic_item_id"] ?: entry["item_id"]).referenceId()]
    var type = "feature_state"
    var record: SheetRollRecord? = null
    val data = buildJsonObject {
        put("instanceUid", uid)
        item?.let {
            put(
                "source",
                buildJsonObject {
                    put("itemId", it.id)
                    put("name", it.name)
                },
            )
        }
    }
        .toMutableMap()
    val action: String
    val patches: List<SheetPatch>
    when (operation) {
        "confirmed-use" -> {
            val use =
                confirmedItemUses(sheet, items, uid).firstOrNull { it.key == input.text("key") }
                    ?: error("Это свойство сейчас недоступно.")
            patches = confirmItemUsePatches(sheet, items, uid, use.key)
            action = "${use.item.name}: ${use.rule.text("confirm_label")}"
            val resource = requireNotNull(use.resource)
            data["resourceSpent"] = JsonPrimitive(use.cost)
            data["resourceChanges"] = buildJsonArray {
                add(
                    buildJsonObject {
                        put("key", resource.key)
                        put("name", resource.title)
                        put("delta", -use.cost)
                        put("remaining", resource.value - use.cost)
                        put("total", resource.total)
                    }
                )
            }
        }
        "last-charge-roll" -> {
            val check = lastChargeCheck(sheet, uid)
            require(
                check.text("id") == input.text("id") &&
                    check.text("status") == "pending" &&
                    lastChargeRuleValid(check["rule"].objectValue())
            ) {
                "Эта проверка уже завершена или отменена."
            }
            val request =
                SheetRollRequest(
                    "Последний заряд: ${check.text("source_name")}",
                    "check",
                    formula = check["rule"].objectValue().text("dice"),
                    sourceItemId = item?.id,
                    sourceName = item?.name ?: check.text("source_name"),
                    targetUid = uid,
                    repeatable = false,
                )
            val result = rollSheet(request, DndDerivedValues(sheet, items, content.metadata))
            record =
                SheetRollRecord(
                    UUID.randomUUID().toString(),
                    request,
                    result,
                    completedAt = System.currentTimeMillis(),
                    sessionUuid = session,
                )
            patches = resolveLastChargePatches(sheet, uid, check.text("id"), result.total)
            type = "dice_roll"
            action =
                "Последний заряд · ${check.text("source_name")}: ${if(result.total <= check["rule"].objectValue()["failure_max"].number()) "магия утрачена" else "магия сохранена"}"
            data.putAll(diceEventData(request, result))
            data["checkId"] = check.getValue("id")
        }
        "last-charge-undo" -> {
            patches = undoLastChargePatches(sheet, uid, input.text("id"))
            action = "Отменена проверка последнего заряда"
            data["checkId"] = JsonPrimitive(input.text("id"))
        }
        else -> error("Неизвестное действие свойства.")
    }
    val metadata =
        if (session != null) sessionMetadata(session, type, action, JsonObject(data))
        else
            listOf(
                buildJsonObject {
                    put("type", type)
                    put("action", action)
                    put("data", JsonObject(data))
                }
            )
    sheets.enqueue(
        uuid,
        patches,
        sheet.data,
        metadata = metadata,
        checkpoint =
            record?.let {
                CachedSheetSection(uuid, SheetRollRecord.SECTION, WireJson.encodeToString(it))
            },
    )
}
