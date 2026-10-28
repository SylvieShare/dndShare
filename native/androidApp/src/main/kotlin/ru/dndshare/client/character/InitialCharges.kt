package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

data class InitialChargeStock(val key: String, val title: String, val rule: JsonObject)

fun initialChargeStocks(data: JsonObject): List<InitialChargeStock> {
    val resources = data["use_resources"].arrayValue()
    if (resources.isNotEmpty())
        return resources.mapNotNull { raw ->
            val row = raw.objectValue()
            val key = row.text("key")
            val rule = row["initial_charges"] as? JsonObject
            if (key.isBlank() || rule == null) null
            else InitialChargeStock(key, row.text("title").ifBlank { key }, rule)
        }
    return (data["initial_charges"] as? JsonObject)
        ?.let { listOf(InitialChargeStock("", "Начальный запас зарядов", it)) }
        .orEmpty()
}

fun initialChargeValue(state: JsonObject, key: String): Int? {
    val raw = if (key.isBlank()) state["max_use"] else state["resource_maxima"].objectValue()[key]
    return (raw as? JsonPrimitive)?.content?.toIntOrNull()?.takeIf { it in 0..100 }
}

/** Existing maxima, including zero, are immutable; a newly initialized stock starts full. */
fun initializeMagicCharges(
    item: CatalogueItem,
    previous: JsonObject,
    proposed: JsonObject,
): JsonObject {
    var state = proposed["magic"].objectValue()
    val before = previous["magic"].objectValue()
    for (stock in initialChargeStocks(item.data)) {
        val existing = initialChargeValue(before, stock.key)
        val value =
            existing
                ?: if (stock.rule.text("mode") == "fixed") {
                    stock.rule["value"].number(-1).takeIf { it in 0..100 }
                        ?: error("Проверьте начальный запас зарядов в справочнике.")
                } else
                    initialChargeValue(state, stock.key)
                        ?: error("Определите начальный запас: ${stock.title}.")
        if (stock.key.isBlank()) {
            val remaining =
                if (existing == null) value else inputChargeCount(state["remaining"], value)
            state =
                JsonObject(
                    state +
                        mapOf(
                            "max_use" to JsonPrimitive(value),
                            "remaining" to JsonPrimitive(remaining),
                        )
                )
        } else {
            val counts = state["resource_counts"].objectValue()
            val remaining =
                if (existing == null) value else inputChargeCount(counts[stock.key], value)
            state =
                JsonObject(
                    state +
                        mapOf(
                            "resource_maxima" to
                                JsonObject(
                                    state["resource_maxima"].objectValue() +
                                        (stock.key to JsonPrimitive(value))
                                ),
                            "resource_counts" to
                                JsonObject(counts + (stock.key to JsonPrimitive(remaining))),
                        )
                )
        }
    }
    return if (state.isEmpty() && proposed["magic"] == null) proposed
    else JsonObject(proposed + ("magic" to state))
}

private fun inputChargeCount(value: JsonElement?, maximum: Int): Int {
    val count =
        if (value == null || value == JsonNull) maximum
        else
            (value as? JsonPrimitive)?.content?.toIntOrNull()
                ?: error("Введите целое число оставшихся зарядов.")
    require(count in 0..maximum) { "Число оставшихся зарядов: от 0 до $maximum." }
    return count
}
