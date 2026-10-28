package ru.dndshare.client.character.creation

import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

internal fun applyStartingPossessions(
    context: CreationContext,
    values: MutableMap<String, JsonElement>,
) {
    val shop = context.draft.buyEquipment && context.draft.version == "2014"
    val (classItems, classGold) = selectedEquipment(context)
    val (backgroundItems, backgroundCoins) = backgroundEquipment(context)
    val raw =
        if (shop)
            context.draft.cart.map { row ->
                JsonObject(
                    row +
                        mapOf(
                            "name" to
                                JsonPrimitive(
                                    context.items[row["item_id"].referenceId()]?.name.orEmpty()
                                ),
                            "typeId" to
                                JsonPrimitive(
                                    context.items[row["item_id"].referenceId()]?.typeId ?: 0
                                ),
                        )
                )
            }
        else classItems + backgroundItems
    val merged = linkedMapOf<Pair<JsonElement?, JsonObject>, JsonObject>()
    for (entry in raw) {
        val key = entry["item_id"] to entry["params"].objectValue()
        val previous = merged[key]
        merged[key] =
            if (previous == null) entry
            else
                JsonObject(
                    previous +
                        ("count" to
                            JsonPrimitive(previous["count"].number(1) + entry["count"].number(1)))
                )
    }
    val weapons = mutableListOf<JsonElement>()
    val equipped = mutableListOf<JsonElement>()
    val bag = mutableListOf<JsonElement>()
    for (entry in merged.values) {
        val item = context.items[entry["item_id"].referenceId()]
        val count = entry["count"].number(1).coerceAtLeast(1)
        fun owned() = buildJsonObject {
            put("uid", UUID.randomUUID().toString())
            put("item_id", entry["item_id"] ?: JsonNull)
            val params = entry["params"].objectValue().toMutableMap()
            if (item?.typeId == 1L) params["magic_bonus"] = JsonPrimitive(0)
            put("params", JsonObject(params))
            put("count", if (item?.typeId == 19L) 1 else count)
            put(
                "override",
                if (item == null) buildJsonObject { put("name", entry.text("name")) } else JsonNull,
            )
        }
        when {
            item?.typeId == 1L ->
                repeat(count) {
                    weapons.add(
                        JsonObject(
                            owned() - "count" +
                                mapOf(
                                    "proficient" to JsonPrimitive(false),
                                    "stat_suggest_id" to JsonNull,
                                    "desc" to JsonPrimitive(""),
                                    "add_attacks" to JsonArray(emptyList()),
                                )
                        )
                    )
                }
            item?.data?.get("armor") is JsonObject || item?.data?.get("armor_base") is JsonObject ->
                equipped.add(owned())
            item?.typeId == 19L -> repeat(count) { bag.add(owned()) }
            else -> bag.add(owned())
        }
    }
    if (weapons.isNotEmpty()) values["weapon"] = JsonArray(weapons)
    if (equipped.isNotEmpty() || bag.isNotEmpty()) {
        val all = equipped + bag
        val slots =
            JsonObject(
                all.mapIndexed { index, row ->
                        row.objectValue().text("uid") to JsonPrimitive(index)
                    }
                    .toMap()
            )
        values["items"] = buildJsonObject {
            put("equipped", JsonArray(equipped))
            put(
                "sections",
                buildJsonArray {
                    add(
                        buildJsonObject {
                            put("id", "bag")
                            put("name", "Снаряжение")
                            put("items", JsonArray(bag))
                            put("slots", slots)
                        }
                    )
                },
            )
        }
    }
    val amounts = (1..5).associate { it.toString() to 0 }.toMutableMap()
    if (shop) {
        var left = context.draft.wealth?.get("gold").number() * 100 - cartCopper(context)
        require(left >= 0) { "Стоимость покупок превышает стартовые деньги." }
        amounts["3"] = left / 100
        left %= 100
        amounts["2"] = left / 10
        amounts["1"] = left % 10
    } else {
        for ((key, amount) in backgroundCoins) amounts[key] = (amounts[key] ?: 0) + amount
        if (context.draft.version == "2024") amounts["3"] = (amounts["3"] ?: 0) + classGold
    }
    values["money"] = buildJsonObject {
        put("order", JsonArray((1..5).map(::JsonPrimitive)))
        put("amounts", JsonObject(amounts.mapValues { JsonPrimitive(it.value) }))
    }
}
