package ru.dndshare.client.character

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import ru.dndshare.client.model.CatalogueItem
import ru.dndshare.client.model.text

@Serializable
data class StatusRollBinding(val uid: String, val effectId: Long, val action: String, val params: JsonObject, val confirmed: Boolean = false)

data class StatusMechanic(val row: JsonObject, val effect: CatalogueItem, val uid: String) {
    val params = row["params"].objectValue()
    val ongoing = effect.data["ongoing_damage"] as? JsonObject
    val repeat = effect.data["repeat_save"] as? JsonObject
    val phase = params.text("damage_phase").ifBlank { "initial_damage" }
    val damagePhase = phase in setOf("initial_damage", "turn_damage")
    val count = (params["damage_dice"] ?: ongoing?.get("dice_count")).number().coerceAtLeast(0)
    val repeatDC = (repeat?.get("dc")?.number()?.takeIf { it > 0 } ?: params["save_dc"].number()).takeIf { it in 1..100 }
}

fun statusMechanic(sheet: CharacterSheet, items: Map<Long, CatalogueItem>, uid: String): StatusMechanic? {
    val row = sheet.values["states"].arrayValue().mapIndexed { i, raw ->
        val state = raw.objectValue()
        val key = state.text("uid").ifBlank { "status-${state["effect_id"].referenceId()}-$i" }
        key to state
    }.firstOrNull { it.first == uid }?.second ?: return null
    if (row["external_only"] == JsonPrimitive(true)) return null
    return items[row["effect_id"].referenceId()]?.let { StatusMechanic(row, it, uid) }
}

private fun StatusMechanic.checkBinding(binding: StatusRollBinding) {
    require(effect.id == binding.effectId && params == binding.params) { "Состояние изменилось. Откройте действие ещё раз." }
    when (binding.action) {
        "damage" -> require(ongoing != null && damagePhase && count > 0)
        "save" -> require(ongoing != null && phase in setOf("initial_save", "turn_save"))
        "repeat" -> require(repeat != null && repeatDC != null && (repeat.text("condition").isBlank() || binding.confirmed))
        else -> error("Неизвестное действие состояния.")
    }
}

fun StatusMechanic.bind(action: String, confirmed: Boolean = false) =
    StatusRollBinding(uid, effect.id, action, params, confirmed).also(::checkBinding)

private fun StatusMechanic.after(sheet: CharacterSheet, items: Map<Long, CatalogueItem>, next: JsonObject?): JsonArray {
    val before = sheet.values["states"].arrayValue()
    val rows = before.mapIndexedNotNull { i, raw ->
        val state = raw.objectValue()
        if (state.text("uid").ifBlank { "status-${state["effect_id"].referenceId()}-$i" } != uid) raw
        else next?.let { JsonObject(state + ("params" to it)) }
    }
    return JsonArray(if (next == null) withStatusEndEffects(before, rows, items) else rows)
}

@Serializable
data class StatusSaveOutcomes(val dc: Int, val before: JsonArray, val success: JsonArray, val failure: JsonArray) {
    fun resolve(total: Int) = if (total >= dc) success else failure
}

fun statusSaveOutcomes(sheet: CharacterSheet, items: Map<Long, CatalogueItem>, binding: StatusRollBinding): StatusSaveOutcomes {
    val status = requireNotNull(statusMechanic(sheet, items, binding.uid)) { "Состояние уже снято." }
    status.checkBinding(binding)
    val before = sheet.values.getValue("states").jsonArray
    if (binding.action == "repeat") return StatusSaveOutcomes(requireNotNull(status.repeatDC), before, status.after(sheet, items, null), before)
    require(binding.action == "save")
    val config = requireNotNull(status.ongoing)
    fun result(count: Int): JsonArray {
        val params = if (count <= 0) null else JsonObject(status.params + mapOf(
            "damage_dice" to JsonPrimitive(count), "damage_phase" to JsonPrimitive("turn_damage")))
        return status.after(sheet, items, params)
    }
    val reduced = if (status.phase == "initial_save") 0 else status.count - config["decrease_on_save"].number(1)
    return StatusSaveOutcomes(config["save_dc"].number(), before, result(reduced), result(status.count))
}

fun statusDamagePatches(sheet: CharacterSheet, items: Map<Long, CatalogueItem>, binding: StatusRollBinding, total: Int): List<SheetPatch> {
    val status = requireNotNull(statusMechanic(sheet, items, binding.uid)) { "Состояние уже снято." }
    status.checkBinding(binding)
    require(binding.action == "damage")
    val damageType = status.ongoing?.get("damage_type").referenceId()
    val kinds = sheetDefenses(sheet, items).filter { it["damage_type"].referenceId() == damageType }.map { it.text("kind") }
    var amount = total.coerceAtLeast(0)
    if ("immunity" in kinds) amount = 0
    if ("resistance" in kinds) amount /= 2
    if ("vulnerability" in kinds) amount *= 2
    val hp = sheet.values["hp"].objectValue()
    val temp = hp["temp"].number().coerceAtLeast(0)
    val next = JsonObject(status.params + mapOf("damage_dice" to JsonPrimitive(status.count),
        "damage_phase" to JsonPrimitive(if (status.phase == "initial_damage") "initial_save" else "turn_save")))
    return listOf(
        SheetPatch(path = sheetPath("values", "hp", "temp"), value = JsonPrimitive((temp - amount).coerceAtLeast(0))),
        SheetPatch(path = sheetPath("values", "hp", "current"), value = JsonPrimitive((hp["current"].number() - (amount - temp).coerceAtLeast(0)).coerceAtLeast(0))),
        SheetPatch(path = sheetPath("values", "states"), value = status.after(sheet, items, next)),
    )
}

fun statusWeapons(sheet: CharacterSheet, items: Map<Long, CatalogueItem>, status: StatusMechanic): List<JsonObject> {
    val rule = status.effect.data["weapon_target"] as? JsonObject ?: return emptyList()
    val types = rule["damage_types"].arrayValue().mapNotNull { it.referenceId() }
    return sheet.values["weapon"].arrayValue().map { it.objectValue() }.filter { weapon ->
        types.isEmpty() || resolveWeapon(weapon, items)?.data?.get("attacks").arrayValue().any {
            it.objectValue()["type"].referenceId() in types
        }
    }
}

fun setStatusParameter(sheet: CharacterSheet, items: Map<Long, CatalogueItem>, uid: String, input: JsonObject): SheetPatch {
    val status = requireNotNull(statusMechanic(sheet, items, uid)) { "Состояние уже снято." }
    val key = input.text("key")
    val value = input.getValue("value")
    when (key) {
        "weapon_uid" -> require(status.params.text(key).isBlank() && statusWeapons(sheet, items, status).any { it["uid"] == value })
        "save_dc" -> require(status.repeat != null && status.repeat["dc"].number() <= 0 && value.number() in 1..100)
        else -> error("Неизвестный параметр состояния.")
    }
    return SheetPatch(path = sheetPath("values", "states"), value = status.after(sheet, items, JsonObject(status.params + (key to value))))
}
