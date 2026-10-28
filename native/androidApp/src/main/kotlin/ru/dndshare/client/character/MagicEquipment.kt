package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

enum class MagicEquipmentKind(
    val field: String,
    val parameter: String,
    val typeId: Long,
    val title: String,
) {
    Weapon("weapon", "weapon_base_item_id", 1, "Основа оружия"),
    Armor("armor_base", "armor_base_item_id", 12, "Основа доспеха"),
}

fun magicEquipmentBase(item: CatalogueItem, params: JsonObject, kind: MagicEquipmentKind): Long? {
    if (item.typeId != 19L) return null
    val rule = item.data[kind.field] as? JsonObject ?: return null
    val id = (rule["base_item_id"] ?: params[kind.parameter]).referenceId() ?: return null
    val allowed = rule["allowed_base_item_ids"].arrayValue().mapNotNull { it.referenceId() }
    return id.takeIf {
        it > 0 && (rule["base_item_id"].referenceId() != null || allowed.isEmpty() || it in allowed)
    }
}

fun eligibleMagicEquipmentBase(
    item: CatalogueItem,
    base: CatalogueItem,
    kind: MagicEquipmentKind,
): Boolean {
    if (base.typeId != kind.typeId || base.id == 64L) return false
    if (kind == MagicEquipmentKind.Armor && base.data["armor"] !is JsonObject) return false
    val rule = item.data[kind.field] as? JsonObject ?: return false
    val fixed = rule["base_item_id"].referenceId()
    val allowed = rule["allowed_base_item_ids"].arrayValue().mapNotNull { it.referenceId() }
    return if (fixed != null) base.id == fixed else allowed.isEmpty() || base.id in allowed
}

fun materializeMagicWeapon(
    entry: JsonObject,
    item: CatalogueItem,
    items: Map<Long, CatalogueItem>,
): JsonObject {
    if (item.typeId != 19L) return JsonObject(entry - "magic_item_id")
    require(item.data["weapon"] is JsonObject) { "Этот предмет не используется как оружие." }
    val params = entry["params"].objectValue()
    val id =
        magicEquipmentBase(item, params, MagicEquipmentKind.Weapon)
            ?: error("Выберите основу оружия.")
    val base = items[id] ?: error("Дождитесь загрузки основы оружия.")
    require(eligibleMagicEquipmentBase(item, base, MagicEquipmentKind.Weapon)) {
        "Эта основа не подходит предмету."
    }
    return JsonObject(
        entry +
            mapOf(
                "item_id" to JsonPrimitive(id),
                "magic_item_id" to JsonPrimitive(item.id),
                "params" to JsonObject(params - MagicEquipmentKind.Weapon.parameter),
            )
    )
}
