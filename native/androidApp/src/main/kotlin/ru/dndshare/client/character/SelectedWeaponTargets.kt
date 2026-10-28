package ru.dndshare.client.character

import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

data class SelectedWeaponTarget(
    val uid: String,
    val item: CatalogueItem,
    val rule: JsonObject,
    val state: JsonObject,
    val active: Boolean,
    val penaltyActive: Boolean,
) {
    val available
        get() = state.isEmpty() || state.text("status") in setOf("expired", "ready")
}

fun selectedWeaponTargets(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
): List<SelectedWeaponTarget> =
    inventoryInstances(sheet).mapNotNull { (entry, equipped) ->
        val item =
            items[(entry["magic_item_id"] ?: entry["item_id"]).referenceId()]
                ?: return@mapNotNull null
        val rule = item.data["selected_target"] as? JsonObject ?: return@mapNotNull null
        val uid = entry.text("uid")
        if (
            uid.isBlank() ||
                rule.text("title").isBlank() ||
                rule["duration_dawns"].number() !in 1..100 ||
                rule["cooldown_dawns"].number() !in 0..100
        )
            return@mapNotNull null
        val state =
            entry["params"].objectValue()["magic"].objectValue()["selected_target"].objectValue()
        val attuned = magicActive(item, entry, true, sheet)
        SelectedWeaponTarget(
            uid,
            item,
            rule,
            state,
            attuned && equipped,
            attuned && state.text("status") == "active",
        )
    }

fun sheetFieldPatch(
    sheet: CharacterSheet,
    path: List<JsonElement>,
    value: JsonElement,
): SheetPatch {
    for (size in 1 until path.size) if (sheetValue(sheet.data, path.take(size)) == null) {
        var nested = value
        for (part in path.drop(size).asReversed()) nested =
            JsonObject(mapOf(part.jsonPrimitive.content to nested))
        return SheetPatch(path = path.take(size), value = nested)
    }
    return SheetPatch(path = path, value = value)
}

fun selectedTargetPatch(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    uid: String,
    operation: String,
    input: JsonObject,
): List<SheetPatch> {
    val source =
        selectedWeaponTargets(sheet, items).firstOrNull { it.uid == uid }
            ?: error("У предмета больше нет выбранной цели.")
    val state = source.state
    val next: JsonElement =
        if (operation == "declare") {
            val name = input.text("name").trim()
            require(source.active && source.available) { "Нельзя заменить действующую цель." }
            require(name.isNotEmpty() && name.codePointCount(0, name.length) <= 120) {
                "Имя цели: от 1 до 120 символов."
            }
            buildJsonObject {
                put("id", UUID.randomUUID().toString())
                put("name", name)
                put("status", "active")
                put("selected", true)
                put("dawns_left", source.rule["duration_dawns"].number())
                put("cooldown_dawns", source.rule["cooldown_dawns"].number())
            }
        } else {
            require(state.isNotEmpty() && input.text("id") == state.text("id")) {
                "Состояние цели изменилось. Откройте форму заново."
            }
            when (operation) {
                "select" -> {
                    require(source.active && state.text("status") == "active")
                    JsonObject(
                        state +
                            ("selected" to JsonPrimitive(input["selected"] == JsonPrimitive(true)))
                    )
                }
                "defeat" -> {
                    require(state.text("status") == "active")
                    val cooldown = state["cooldown_dawns"].number()
                    JsonObject(
                        state +
                            mapOf(
                                "status" to
                                    JsonPrimitive(if (cooldown > 0) "defeated" else "ready"),
                                "selected" to JsonPrimitive(false),
                                "dawns_left" to JsonPrimitive(cooldown),
                            )
                    )
                }
                "correct" -> JsonNull
                else -> error("Неизвестное действие с целью.")
            }
        }
    return listOf(
        sheetFieldPatch(
            sheet,
            inventoryInstancePath(sheet, uid) + sheetPath("params", "magic", "selected_target"),
            next,
        )
    )
}

fun advanceSelectedWeaponTargets(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
): List<SheetPatch> =
    selectedWeaponTargets(sheet, items)
        .filter { it.state.text("status") in setOf("active", "defeated") }
        .map { source ->
            val left = (source.state["dawns_left"].number() - 1).coerceAtLeast(0)
            val status =
                if (left > 0) source.state.text("status")
                else if (source.state.text("status") == "defeated") "ready" else "expired"
            val next =
                JsonObject(
                    source.state +
                        mapOf(
                            "dawns_left" to JsonPrimitive(left),
                            "status" to JsonPrimitive(status),
                            "selected" to
                                JsonPrimitive(
                                    left > 0 && source.state["selected"] == JsonPrimitive(true)
                                ),
                        )
                )
            sheetFieldPatch(
                sheet,
                inventoryInstancePath(sheet, source.uid) +
                    sheetPath("params", "magic", "selected_target"),
                next,
            )
        }

fun selectedWeaponTargetDamage(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
): List<JsonObject> =
    selectedWeaponTargets(sheet, items)
        .filter { it.active && it.state.text("status") == "active" }
        .map { source ->
            JsonObject(
                source.rule["damage"].objectValue() +
                    buildJsonObject {
                        put("key", "target:${source.uid}:${source.state.text("id")}")
                        put("label", "По выбранной цели: ${source.state.text("name")}")
                        put("source_label", source.item.name)
                        put("owner_level", 1)
                        put("weapon_uid", source.uid)
                        if (source.rule["ranged_only"] == JsonPrimitive(true))
                            put("weapon_kind", "ranged")
                        put(
                            "target_choice",
                            buildJsonObject {
                                put("uid", source.uid)
                                put("id", source.state.text("id"))
                                put("selected", source.state["selected"] == JsonPrimitive(true))
                            },
                        )
                        put("double_on_critical", true)
                        put("condition", source.rule.text("condition"))
                    }
            )
        }

fun selectedWeaponTargetRolls(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
): List<OwnedDerivedRule> = buildList {
    for (source in selectedWeaponTargets(sheet, items)) {
        fun rule(mode: String, excluded: Boolean) =
            OwnedDerivedRule(
                buildJsonObject {
                    put("kind", "roll_mode")
                    put("mode", mode)
                    put("scopes", JsonArray(listOf(JsonPrimitive("attack"))))
                    put("weapon_attacks_only", true)
                    put(if (excluded) "excluded_weapon_uid" else "weapon_uid", source.uid)
                    if (!excluded) {
                        put("forbid_improvised", true)
                        if (source.rule["ranged_only"] == JsonPrimitive(true))
                            put("weapon_kind", "ranged")
                    }
                },
                JsonObject(emptyMap()),
                sourceLabel =
                    "${source.item.name}: ${source.state.text("name").ifBlank {source.rule.text("title")}}",
            )
        if (
            source.active &&
                source.state.text("status") == "active" &&
                source.state["selected"] == JsonPrimitive(true) &&
                source.rule["attack_advantage"] == JsonPrimitive(true)
        )
            add(rule("advantage", false))
        if (
            source.penaltyActive && source.rule["other_weapons_disadvantage"] == JsonPrimitive(true)
        )
            add(rule("disadvantage", true))
    }
}
