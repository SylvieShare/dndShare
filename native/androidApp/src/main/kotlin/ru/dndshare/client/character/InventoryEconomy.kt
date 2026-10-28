package ru.dndshare.client.character

import kotlin.math.floor
import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

data class InventoryEconomy(val cost: JsonElement?, val weight: Double?)

fun resolveInventoryItem(entry: JsonObject, items: Map<Long, CatalogueItem>): CatalogueItem? {
    if (entry["magic_item_id"].referenceId() != null) return resolveWeapon(entry, items)
    val item = items[entry["item_id"].referenceId()] ?: return null
    val custom = entry["override"].objectValue()
    return item.copy(
        name = custom.text("name").ifBlank { item.name },
        data = JsonObject(item.data + custom),
    )
}

private fun JsonElement?.decimal(): Double? {
    val raw = this as? JsonPrimitive ?: return null
    return (if (raw.isString && raw.content.isBlank()) 0.0 else raw.doubleOrNull)?.takeIf {
        it.isFinite()
    }
}

private fun inventoryRounded(value: Double) = floor(value * 1e8 + .5) / 1e8

private fun inventoryNumber(value: Double): JsonElement =
    if (!value.isFinite()) JsonNull
    else if (value % 1.0 == 0.0 && value >= Long.MIN_VALUE && value <= Long.MAX_VALUE)
        JsonPrimitive(value.toLong())
    else JsonPrimitive(value)

/** Catalogue prices/weights are per purchase; explicit overrides describe one owned unit. */
fun inventoryItemEconomy(item: CatalogueItem?, entry: JsonObject): InventoryEconomy {
    val data = item?.data ?: JsonObject(emptyMap())
    val custom = entry["override"].objectValue()
    val params = entry["params"].objectValue()
    val count = (entry["count"].decimal() ?: 1.0).coerceAtLeast(1.0)
    val quantity = data["purchase_quantity"].decimal()?.takeIf { it > 0 && it % 1.0 == 0.0 } ?: 1.0
    val length = params["length_ft"].decimal()?.takeIf { it > 0 }
    val measuredCost =
        if (
            length != null &&
                data["unit_cost_copper"] != null &&
                data["unit_cost_copper"] != JsonNull
        )
            buildJsonObject {
                put(
                    "value",
                    inventoryNumber(length * (data["unit_cost_copper"].decimal() ?: Double.NaN)),
                )
                put("suggest_id", 1)
            }
        else null
    val measuredWeight =
        if (length != null && data["unit_weight"] != null && data["unit_weight"] != JsonNull)
            length * (data["unit_weight"].decimal() ?: Double.NaN)
        else null
    val ownCost = custom["cost"]?.takeUnless { it == JsonNull }
    val ownWeight = custom["weight"]?.takeUnless { it == JsonNull }
    val cost = ownCost ?: measuredCost ?: data["cost"]?.takeUnless { it == JsonNull }
    val weight =
        if (ownWeight != null) ownWeight.decimal() else measuredWeight ?: data["weight"].decimal()
    val costFactor = if (ownCost != null || measuredCost != null) count else count / quantity
    val weightFactor = if (ownWeight != null || measuredWeight != null) count else count / quantity
    val scaled =
        if (cost is JsonObject)
            JsonObject(
                cost.mapValues { (key, raw) ->
                    if (
                        key in setOf("value", "min", "max") &&
                            raw != JsonNull &&
                            (raw as? JsonPrimitive)?.content != ""
                    )
                        raw.decimal()?.let { inventoryNumber(inventoryRounded(it * costFactor)) }
                            ?: raw
                    else raw
                }
            )
        else cost
    return InventoryEconomy(
        scaled,
        weight?.let { inventoryRounded(it * weightFactor) }?.takeIf { it.isFinite() },
    )
}

fun inventoryEntriesWeight(entries: List<JsonObject>, items: Map<Long, CatalogueItem>): Double =
    inventoryRounded(
        entries.sumOf { inventoryItemEconomy(resolveInventoryItem(it, items), it).weight ?: 0.0 }
    )
