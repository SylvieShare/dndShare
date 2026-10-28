package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.creation.*
import ru.dndshare.client.model.*

/** Only bonuses owned by this exact feat instance are replaced. Manual bonuses survive. */
fun featStatBonusPatches(
    sheet: CharacterSheet,
    before: JsonObject,
    after: JsonObject?,
    item: CatalogueItem?,
): List<SheetPatch> {
    val patches = mutableListOf<SheetPatch>()
    val previousKey = "feat:${before.text("uid").ifBlank { before.text("id") }}"
    val bonuses = mutableMapOf<String, Int>()
    if (item != null && after != null && after["requirements_met"] != JsonPrimitive(false)) {
        val rows = item.data["asi"].arrayValue().map { it.objectValue() }.toMutableList()
        val choices = after["choices"].objectValue()
        val asi = item.data["asi_choice"].objectValue()
        for (id in choices[asi.text("choice_key").ifBlank { "ability" }].arrayValue()) if (
            asi.isNotEmpty()
        )
            rows.add(
                buildJsonObject {
                    put("ability", id)
                    put("bonus", asi["bonus"].number())
                }
            )
        for (choice in itemChoices(item)) for (id in choices[choice.text("key")].arrayValue()) if (
            choice["ability_bonus"].number() != 0
        )
            rows.add(
                buildJsonObject {
                    put("ability", id)
                    put("bonus", choice["ability_bonus"].number())
                }
            )
        rows.forEach { row ->
            creationStats.getOrNull(row["ability"].number() - 1)?.let {
                bonuses[it] = (bonuses[it] ?: 0) + row["bonus"].number()
            }
        }
    }
    for (stat in creationStats) {
        val block = sheet.values[stat].objectValue()
        val raw = block["value"]
        val value = if (raw is JsonObject) raw else buildJsonObject { put("base", raw.number(10)) }
        var next =
            value["bonuses"].arrayValue().filterNot {
                it.objectValue().text("sourceFeatKey") == previousKey
            }
        val total = value["base"].number(10) + JsonArray(next).bonusTotal()
        val bonus = (bonuses[stat] ?: 0).coerceAtMost((20 - total).coerceAtLeast(0))
        if (bonus > 0 && item != null)
            next =
                next +
                    buildJsonObject {
                        put("name", item.name)
                        put("title", item.name)
                        put("value", bonus)
                        put("readonly", true)
                        put(
                            "sourceFeatKey",
                            "feat:${after!!.text("uid").ifBlank { item.id.toString() }}",
                        )
                    }
        if (next != value["bonuses"].arrayValue())
            patches.add(
                SheetPatch(
                    path = sheetPath("values", stat),
                    value =
                        JsonObject(
                            block + ("value" to JsonObject(value + ("bonuses" to JsonArray(next))))
                        ),
                )
            )
    }
    return patches
}
