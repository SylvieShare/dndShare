package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

fun restPatches(
    sheet: CharacterSheet,
    input: JsonObject,
    items: Map<Long, CatalogueItem>,
): List<SheetPatch> {
    val kind = input.text("kind")
    require(kind in setOf("short", "long", "dawn"))
    var next = sheet
    fun update(key: String, value: JsonElement) {
        next =
            next.copy(
                data =
                    applySheetPatches(
                        next.data,
                        listOf(SheetPatch(path = sheetPath("values", key), value = value)),
                    )
            )
    }
    val hp = sheet.values["hp"].objectValue()
    val maximum = sheet.hpMaximum() + featureHpBonus(sheet, items)
    val pools = hp["hitDice"].arrayValue().map { it.objectValue() }
    if (kind == "long") {
        val total = pools.sumOf { it["total"].number() }
        var remaining = if (sheet.sourceVersion == "2024") total else maxOf(1, total / 2)
        val restored = pools.map { row ->
            val used = row["used"].number()
            val requested = input["recovery"].objectValue()[row.text("die")]?.number() ?: remaining
            val amount = minOf(remaining, used, requested.coerceAtLeast(0))
            remaining -= amount
            JsonObject(row + ("used" to JsonPrimitive(used - amount)))
        }
        update(
            "hp",
            JsonObject(
                hp +
                    mapOf(
                        "current" to JsonPrimitive(maximum),
                        "temp" to JsonPrimitive(0),
                        "ds_success" to JsonPrimitive(0),
                        "ds_failure" to JsonPrimitive(0),
                        "hitDice" to JsonArray(restored),
                    )
            ),
        )
        val exhaustion = sheet.values["exhaustion"].objectValue()
        if (exhaustion["level"].number() > 0)
            update(
                "exhaustion",
                JsonObject(
                    exhaustion + ("level" to JsonPrimitive(exhaustion["level"].number() - 1))
                ),
            )
    } else if (kind == "short") {
        val spent = input["hitDiceSpent"].arrayValue().map { it.objectValue() }
        val updatedPools = pools.map { row ->
            val count = spent.count { it.text("die") == row.text("die") }
            require(count <= row["total"].number() - row["used"].number()) {
                "Недостаточно костей хитов."
            }
            JsonObject(row + ("used" to JsonPrimitive(row["used"].number() + count)))
        }
        if (spent.isNotEmpty())
            update(
                "hp",
                JsonObject(
                    hp +
                        mapOf(
                            "current" to
                                JsonPrimitive(
                                    minOf(
                                        maximum,
                                        hp["current"].number() +
                                            spent.sumOf { it["healing"].number().coerceAtLeast(0) },
                                    )
                                ),
                            "hitDice" to JsonArray(updatedPools),
                        )
                ),
            )
    }
    if (kind != "dawn" && sheet.values["spells"] is JsonObject) {
        val spells = sheet.values["spells"].objectValue()
        val slots = spells["slot_pools"].objectValue()
        val updated = slots.toMutableMap()
        for (pool in
            if (kind == "long") listOf("long_rest", "short_rest")
            else listOf("short_rest")) updated[pool] =
            JsonArray(
                slots[pool].arrayValue().map {
                    JsonObject(it.objectValue() + ("used" to JsonPrimitive(0)))
                }
            )
        update("spells", JsonObject(spells + ("slot_pools" to JsonObject(updated))))
    }
    for (resource in resourceControls(next, items, includeInactive = true)) {
        val rule = resource.rule
        val short =
            rule["short_rest"] == JsonPrimitive(true) ||
                rule["rollback_short_rest"] == JsonPrimitive(true) ||
                (rule["rollback_short_rest_level"] != null &&
                    resource.ownerLevel >= rule["rollback_short_rest_level"].number())
        val long =
            rule["long_rest"] == JsonPrimitive(true) ||
                rule["rollback_long_rest"] == JsonPrimitive(true)
        val partial =
            if (
                rule["short_rest_recovery_level"] == null ||
                    resource.ownerLevel >= rule["short_rest_recovery_level"].number()
            )
                rule["short_rest_recovery"].number()
            else 0
        val dawn = rule["dawn_recovery"].objectValue()
        val amount =
            when {
                kind == "long" && (long || short) -> resource.total
                kind == "short" && short -> resource.total
                kind == "short" -> minOf(resource.total, resource.value + partial.coerceAtLeast(0))
                kind == "dawn" && dawn.text("mode") == "full" -> resource.total
                kind == "dawn" && dawn.text("mode") == "roll" -> {
                    val rolled =
                        input["dawnRolls"].objectValue()[resource.key]?.number()
                            ?: error("Бросьте кости восстановления на рассвете.")
                    minOf(resource.total, resource.value + rolled.coerceAtLeast(0))
                }
                else -> resource.value
            }
        if (amount != resource.value)
            next =
                next.copy(
                    data =
                        applySheetPatches(
                            next.data,
                            listOf(resourceValuePatch(next, resource, amount)),
                        )
                )
    }
    if (kind == "dawn")
        next =
            next.copy(
                data =
                    applySheetPatches(
                        next.data,
                        advanceSelectedWeaponTargets(next, items) +
                            advanceItemUseCooldowns(next, items),
                    )
            )
    return (sheet.values.keys + next.values.keys).mapNotNull { key ->
        next.values[key]
            ?.takeIf { it != sheet.values[key] }
            ?.let { SheetPatch(path = sheetPath("values", key), value = it) }
    }
}
