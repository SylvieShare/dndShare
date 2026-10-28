package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

data class WeaponBonusTransfer(
    val title: String,
    val condition: String,
    val max: Int,
    val selected: Int,
    val value: Int,
    val active: Boolean,
)

fun weaponBonusTransfer(
    sheet: CharacterSheet,
    entry: JsonObject,
    item: CatalogueItem,
    equipped: Boolean = true,
): WeaponBonusTransfer? {
    val rule = item.data["weapon_bonus_transfer"] as? JsonObject ?: return null
    val bonus = item.data["weapon"].objectValue()["magic_bonus"].number()
    if (entry["magic_item_id"].referenceId() == null || bonus !in 1..3) return null
    val selected =
        entry["params"]
            .objectValue()["magic"]
            .objectValue()["bonus_transfer"]
            .number()
            .coerceIn(0, bonus)
    val active = equipped && magicActive(item, entry, equipped, sheet)
    return WeaponBonusTransfer(
        rule.text("title").ifBlank { "Перенести в защиту" },
        rule.text("condition"),
        bonus,
        selected,
        if (active) selected else 0,
        active,
    )
}

fun transferArmorRules(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
): List<OwnedDerivedRule> =
    inventoryInstances(sheet).mapNotNull { (entry, equipped) ->
        val item = items[entry["magic_item_id"].referenceId()] ?: return@mapNotNull null
        val transfer = weaponBonusTransfer(sheet, entry, item, equipped) ?: return@mapNotNull null
        if (transfer.value == 0) return@mapNotNull null
        OwnedDerivedRule(
            buildJsonObject {
                put("kind", "armor_bonus")
                put("value", transfer.value)
            },
            entry,
            sourceLabel = "${item.name}: перенос в защиту",
        )
    }

fun weaponBonusTransferPatch(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    uid: String,
    amount: Int,
): List<SheetPatch> {
    val (entry, equipped) =
        inventoryInstances(sheet).firstOrNull { it.first.text("uid") == uid }
            ?: error("Предмет больше не существует.")
    val item =
        items[entry["magic_item_id"].referenceId()] ?: error("Описание предмета не загружено.")
    val transfer =
        weaponBonusTransfer(sheet, entry, item, equipped)
            ?: error("Предмет не переносит бонус в защиту.")
    require(amount in 0..transfer.max && (amount == 0 || transfer.active)) {
        "Перенос сейчас недоступен."
    }
    return listOf(
        sheetFieldPatch(
            sheet,
            inventoryInstancePath(sheet, uid) + sheetPath("params", "magic", "bonus_transfer"),
            JsonPrimitive(amount),
        )
    )
}
