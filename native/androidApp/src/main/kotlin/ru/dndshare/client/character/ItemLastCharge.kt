package ru.dndshare.client.character

import java.time.Instant
import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

fun lastChargeRuleValid(rule: JsonObject): Boolean {
    val sides = rule.text("dice").removePrefix("d").toIntOrNull() ?: return false
    return rule.text("dice") == "d$sides" &&
        sides in setOf(4, 6, 8, 10, 12, 20, 100) &&
        rule["failure_max"]?.jsonPrimitive?.intOrNull in 1..sides &&
        rule.text("consequence") == "lose_magic"
}

/** Every spending path uses this transaction; recovery deliberately uses resourceValuePatch. */
fun resourceChangePatches(
    sheet: CharacterSheet,
    resource: ResourceControl,
    amount: Int,
    items: Map<Long, CatalogueItem>,
): List<SheetPatch> {
    val available = amount.coerceIn(0, resource.total)
    val counter = resourceValuePatch(sheet, resource, available)
    val owner = resource.owner
    if (resource.value <= 0 || available != 0 || owner?.valueId != "magic_items")
        return listOf(counter)
    val item = items[owner.itemId] ?: return listOf(counter)
    val rule = item.data["last_charge"] as? JsonObject ?: return listOf(counter)
    if (!lastChargeRuleValid(rule) || rule.text("resource_key") != owner.resourceKey)
        return listOf(counter)
    val entry =
        inventoryInstances(sheet).firstOrNull { it.first.text("uid") == owner.entryKey }?.first
            ?: return listOf(counter)
    val magic = entry["params"].objectValue()["magic"].objectValue()
    if (
        magic["lost"] == JsonPrimitive(true) ||
            magic["last_charge_check"].objectValue().text("status") == "pending"
    )
        return listOf(counter)
    val working = sheet.copy(data = applySheetPatches(sheet.data, listOf(counter)))
    val check = buildJsonObject {
        put("id", UUID.randomUUID().toString())
        put("status", "pending")
        put("rule", rule)
        put("source_name", item.name)
        put("created_at", Instant.now().toString())
    }
    return listOf(
        counter,
        sheetFieldPatch(
            working,
            inventoryInstancePath(working, owner.entryKey) +
                sheetPath("params", "magic", "last_charge_check"),
            check,
        ),
    )
}

fun lastChargeCheck(sheet: CharacterSheet, uid: String): JsonObject =
    inventoryInstances(sheet)
        .firstOrNull { it.first.text("uid") == uid }
        ?.first
        ?.get("params")
        .objectValue()["magic"]
        .objectValue()["last_charge_check"]
        .objectValue()

/** Stale, duplicate and undone checks cannot roll again, even after movement or process restart. */
fun resolveLastChargePatches(
    sheet: CharacterSheet,
    uid: String,
    id: String,
    result: Int,
): List<SheetPatch> {
    val check = lastChargeCheck(sheet, uid)
    val rule = check["rule"].objectValue()
    require(
        check.text("id") == id && check.text("status") == "pending" && lastChargeRuleValid(rule)
    ) {
        "Эта проверка уже завершена или отменена."
    }
    require(result in 1..rule.text("dice").removePrefix("d").toInt()) {
        "Результат за пределами кости."
    }
    return changeLastCharge(
        sheet,
        uid,
        JsonObject(
            check +
                mapOf(
                    "status" to JsonPrimitive("resolved"),
                    "result" to JsonPrimitive(result),
                    "lost" to JsonPrimitive(result <= rule["failure_max"].number()),
                    "resolved_at" to JsonPrimitive(Instant.now().toString()),
                )
        ),
        result <= rule["failure_max"].number(),
    )
}

fun undoLastChargePatches(sheet: CharacterSheet, uid: String, id: String): List<SheetPatch> {
    val check = lastChargeCheck(sheet, uid)
    require(check.text("id") == id && check.text("status") in setOf("pending", "resolved")) {
        "Эта проверка уже отменена."
    }
    return changeLastCharge(
        sheet,
        uid,
        JsonObject(
            check +
                mapOf(
                    "status" to JsonPrimitive("undone"),
                    "undone_at" to JsonPrimitive(Instant.now().toString()),
                )
        ),
        false,
    )
}

private fun changeLastCharge(
    sheet: CharacterSheet,
    uid: String,
    check: JsonObject,
    lost: Boolean,
): List<SheetPatch> {
    val path = inventoryInstancePath(sheet, uid) + sheetPath("params", "magic")
    val magic = sheetValue(sheet.data, path).objectValue()
    return listOf(
        sheetFieldPatch(
            sheet,
            path,
            JsonObject(magic + mapOf("last_charge_check" to check, "lost" to JsonPrimitive(lost))),
        )
    )
}
