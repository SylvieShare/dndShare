package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

data class ConfirmedItemUse(
    val item: CatalogueItem,
    val uid: String,
    val rule: JsonObject,
    val resource: ResourceControl?,
    val cooldown: Int,
    val error: String,
) {
    val key
        get() = rule.text("key")

    val cost
        get() = rule["resource_cost"].number()
}

fun confirmedItemUses(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    uid: String,
): List<ConfirmedItemUse> {
    val (entry, equipped) =
        inventoryInstances(sheet).firstOrNull { it.first.text("uid") == uid } ?: return emptyList()
    val item =
        items[(entry["magic_item_id"] ?: entry["item_id"]).referenceId()] ?: return emptyList()
    val magic = entry["params"].objectValue()["magic"].objectValue()
    if (magic["lost"] == JsonPrimitive(true)) return emptyList()
    // Resource activation is independent of a use's refined activation.
    val resources = resourceControls(sheet, items)
    return item.data["confirmed_uses"]
        .arrayValue()
        .map { it.objectValue() }
        .filter {
            item.typeId != 19L || magicActive(item, entry, equipped, sheet, it.text("activation"))
        }
        .map { rule ->
            val resource = resources.firstOrNull {
                it.owner?.let { owner ->
                    owner.valueId == "magic_items" &&
                        owner.entryKey == uid &&
                        owner.resourceKey == rule.text("resource_key")
                } == true
            }
            val cooldown =
                magic["use_cooldowns"].objectValue()[rule.text("key")].number().coerceAtLeast(0)
            val error =
                when {
                    rule.text("key").isBlank() || rule.text("title").isBlank() ->
                        "Укажите название и ключ свойства."
                    rule.text("confirm_label").isBlank() ->
                        "Укажите результат, после которого расходуется заряд."
                    rule["resource_cost"]?.jsonPrimitive?.intOrNull !in 1..100 ->
                        "Расход должен быть целым числом от 1 до 100."
                    rule["cooldown_dawns"] != null &&
                        rule["cooldown_dawns"]?.jsonPrimitive?.intOrNull !in 0..100 ->
                        "Ожидание должно быть целым числом от 0 до 100 рассветов."
                    cooldown > 0 -> "До следующего применения: $cooldown рассвет(ов)."
                    resource == null ->
                        if (initialChargeValue(magic, rule.text("resource_key")) != null)
                            "Недостаточно зарядов."
                        else "Задайте запас зарядов в параметрах экземпляра."
                    resource.value < rule["resource_cost"].number() -> "Недостаточно зарядов."
                    else -> ""
                }
            ConfirmedItemUse(item, uid, rule, resource, cooldown, error)
        }
}

fun confirmItemUsePatches(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    uid: String,
    key: String,
): List<SheetPatch> {
    val use =
        confirmedItemUses(sheet, items, uid).firstOrNull { it.key == key }
            ?: error("Это свойство сейчас недоступно.")
    require(use.error.isBlank()) { use.error }
    val resource = requireNotNull(use.resource)
    val patches = resourceChangePatches(sheet, resource, resource.value - use.cost, items)
    val cooldown = use.rule["cooldown_dawns"].number()
    if (cooldown <= 0) return patches
    val working = sheet.copy(data = applySheetPatches(sheet.data, patches))
    return patches +
        sheetFieldPatch(
            working,
            inventoryInstancePath(working, uid) +
                sheetPath("params", "magic", "use_cooldowns", key),
            JsonPrimitive(cooldown),
        )
}

data class ItemUseDawn(val uid: String, val key: String, val title: String, val before: Int) {
    val after
        get() = before - 1
}

fun itemUseDawnCandidates(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
): List<ItemUseDawn> =
    inventoryInstances(sheet).flatMap { (entry, _) ->
        val item =
            items[(entry["magic_item_id"] ?: entry["item_id"]).referenceId()]
                ?: return@flatMap emptyList()
        val magic = entry["params"].objectValue()["magic"].objectValue()
        if (magic["lost"] == JsonPrimitive(true)) return@flatMap emptyList()
        item.data["confirmed_uses"].arrayValue().mapNotNull { raw ->
            val rule = raw.objectValue()
            val count = magic["use_cooldowns"].objectValue()[rule.text("key")].number()
            if (count > 0)
                ItemUseDawn(
                    entry.text("uid"),
                    rule.text("key"),
                    "${item.name}: ${rule.text("title")}",
                    count,
                )
            else null
        }
    }

fun advanceItemUseCooldowns(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
): List<SheetPatch> =
    itemUseDawnCandidates(sheet, items).map { row ->
        val path =
            inventoryInstancePath(sheet, row.uid) +
                sheetPath("params", "magic", "use_cooldowns", row.key)
        if (row.after == 0) SheetPatch(op = "remove", path = path)
        else SheetPatch(path = path, value = JsonPrimitive(row.after))
    }
