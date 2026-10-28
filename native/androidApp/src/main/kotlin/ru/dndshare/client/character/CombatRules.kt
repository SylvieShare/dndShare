package ru.dndshare.client.character

import kotlin.math.*
import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

fun combatRules(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    field: String,
): List<JsonObject> = buildList {
    for (feature in ownedFeatures(sheet, items)) {
        val level = ownerLevel(feature.item.data, sheet)
        for ((index, raw) in feature.item.data[field].arrayValue().withIndex()) {
            val rule = raw.objectValue()
            if (
                feature.item.typeId == 19L &&
                    !magicActive(
                        feature.item,
                        feature.instance,
                        feature.equipped,
                        sheet,
                        rule.text("activation"),
                    )
            )
                continue
            if (level < rule["level"].number(1).coerceAtLeast(1)) continue
            val owner = feature.entry.text("uid").ifBlank { feature.entry.text("id") }
            val prefix = "${feature.key}:$owner:$field:"
            add(
                JsonObject(
                    rule +
                        buildJsonObject {
                            put(
                                "key",
                                prefix +
                                    if (field == "weapon_damage") rule.text("key")
                                    else index.toString(),
                            )
                            if (
                                field == "weapon_damage" &&
                                    rule.text("requires_damage_key").isNotBlank()
                            )
                                put(
                                    "requires_damage_key",
                                    prefix + rule.text("requires_damage_key"),
                                )
                            put("owner_level", level)
                            put("source_label", feature.item.name)
                            put(
                                "resource_owner",
                                buildJsonObject {
                                    put("valueId", feature.key)
                                    put("entryKey", owner)
                                },
                            )
                            if (
                                feature.item.data["weapon"] is JsonObject &&
                                    field in setOf("weapon_damage", "critical_damage")
                            )
                                put("weapon_uid", feature.entry.text("uid"))
                        }
                )
            )
        }
    }
    if (field == "weapon_damage") {
        addAll(selectedWeaponTargetDamage(sheet, items))
        for (raw in sheet.values["states"].arrayValue()) {
            val state = raw.objectValue()
            if (state["external_only"] == JsonPrimitive(true)) continue
            val item = items[state["effect_id"].referenceId()] ?: continue
            val params = state["params"].objectValue()
            if (
                item.data["weapon_target"] != null &&
                    item.data["weapon_target"] != JsonPrimitive(false) &&
                    params.text("weapon_uid").isBlank()
            )
                continue
            for ((index, value) in item.data["weapon_damage"].arrayValue().withIndex()) {
                val rule = value.objectValue()
                add(
                    JsonObject(
                        rule +
                            buildJsonObject {
                                put("key", "status:${state.text("uid")}:damage:$index")
                                put("source_label", item.name)
                                put("owner_level", 1)
                                if (rule.text("dice_count_parameter").isNotBlank())
                                    put(
                                        "dice_count",
                                        params[rule.text("dice_count_parameter")].number(),
                                    )
                                if (params.text("weapon_uid").isNotBlank())
                                    put("weapon_uid", params.getValue("weapon_uid"))
                            }
                    )
                )
            }
        }
    }
}

fun extraCriticalWeaponDice(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    uid: String,
    melee: Boolean,
): Int =
    combatRules(sheet, items, "critical_damage")
        .filter {
            it.text("weapon_uid").let { value -> value.isBlank() || value == uid } &&
                (it.text("weapon_kind") != "melee" || melee)
        }
        .sumOf { it["extra_weapon_dice"].number().coerceAtLeast(0) }

fun weaponDamageDiceCount(rule: JsonObject, level: Int): Int {
    val divisor = (rule["dice_count_level_divisor"] as? JsonPrimitive)?.doubleOrNull ?: 0.0
    if (divisor <= 0) return rule["dice_count"].number().coerceAtLeast(0)
    val value = level.coerceAtLeast(0) / divisor
    return (if (rule.text("dice_count_rounding") == "down") floor(value) else ceil(value))
        .toInt()
        .coerceAtLeast(0)
}

fun matchingWeaponDamageRules(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    uid: String,
    melee: Boolean,
    ranged: Boolean,
    finesse: Boolean,
): List<JsonObject> =
    combatRules(sheet, items, "weapon_damage")
        .filter { rule ->
            (rule.text("weapon_uid").isBlank() || rule.text("weapon_uid") == uid) &&
                when (rule.text("weapon_kind")) {
                    "melee" -> melee
                    "ranged" -> ranged
                    "finesse" -> finesse
                    "finesse_or_ranged" -> finesse || ranged
                    else -> true
                }
        }
        .map { rule ->
            val count = weaponDamageDiceCount(rule, rule["owner_level"].number())
            JsonObject(rule + ("dice_count" to JsonPrimitive(count)))
        }
        .filter {
            it["target_choice"] is JsonObject ||
                it["dice_count"].number() > 0 && it.text("dice").isNotBlank()
        }
