package ru.dndshare.client.character

import kotlinx.serialization.json.*
import kotlin.math.floor
import ru.dndshare.client.model.text

fun JsonElement?.number(default: Int = 0): Int = (this as? JsonPrimitive)?.intOrNull ?: default
fun JsonElement?.objectValue(): JsonObject = this as? JsonObject ?: JsonObject(emptyMap())
fun JsonElement?.arrayValue(): List<JsonElement> = (this as? JsonArray).orEmpty()
fun JsonElement?.bonusTotal(): Int = arrayValue().sumOf { it.objectValue()["value"].number() }
fun JsonObject.label(): String = text("name").ifBlank { text("title") }.ifBlank { text("value") }
fun signed(value: Int): String = if (value >= 0) "+$value" else value.toString()
fun CharacterSheet.statScore(id: String): Int {
    val value = values[id].objectValue()["value"]
    return if (value is JsonObject) value["base"].number(10) + value["bonuses"].bonusTotal() else value.number(10)
}
fun abilityModifier(value: Int): Int = floor((value - 10) / 2.0).toInt()
fun CharacterSheet.hpMaximum(): Int {
    val max = values["hp"].objectValue()["max"]
    return (if (max is JsonObject) max["base"].number() + max["bonuses"].bonusTotal() else max.number()).coerceAtLeast(0)
}
fun CharacterSheet.proficiency(): Int {
    val prof = values["prof_bonus"].objectValue()
    val level = values["lvl"].objectValue()["level"].number(1).coerceIn(1, 20)
    return (if (prof["auto"] == JsonPrimitive(false)) prof["v"].number(2) else (level + 3) / 4 + 1) + prof["bonuses"].bonusTotal()
}
fun CharacterSheet.subtitle(): String = if (templateName == "VTM20") values.text("persona") else
    listOf(values["race"].objectValue().label(), values["classes"].arrayValue().map { it.objectValue().label() }
        .filter(String::isNotBlank).joinToString(" / ")).filter(String::isNotBlank).joinToString(" · ")

fun CharacterSheet.manualStatPatch(id: String, value: Int): SheetPatch {
    val current = values[id].objectValue()
    val numeric = current["value"]
    return if (numeric is JsonObject) SheetPatch(path = sheetPath("values", id, "value", "base"), value = JsonPrimitive(value))
    else SheetPatch(path = sheetPath("values", id), value = JsonObject(current + ("value" to buildJsonObject {
        put("base", value); put("bonuses", JsonArray(emptyList()))
    })))
}

fun CharacterSheet.hpPatches(current: Int, temp: Int, maximumBase: Int): List<SheetPatch> {
    val hp = values["hp"].objectValue()
    val maximum = hp["max"]
    val oldBase = if (maximum is JsonObject) maximum["base"].number() else maximum.number()
    val patches = mutableListOf<SheetPatch>()
    if (current != hp["current"].number()) patches += SheetPatch(path = sheetPath("values", "hp", "current"), value = JsonPrimitive(current))
    if (temp != hp["temp"].number()) patches += SheetPatch(path = sheetPath("values", "hp", "temp"), value = JsonPrimitive(temp))
    if (maximumBase != oldBase) {
        val history = hp["history"].arrayValue().toMutableList()
        val untracked = oldBase - history.sumOf { it.objectValue()["gain"].number() }
        if (untracked != 0) history += buildJsonObject { put("kind", "untracked"); put("gain", untracked) }
        history += buildJsonObject { put("kind", "manual"); put("gain", maximumBase - oldBase) }
        patches += SheetPatch(path = sheetPath("values", "hp", "history"), value = JsonArray(history))
        patches += if (maximum is JsonObject) SheetPatch(path = sheetPath("values", "hp", "max", "base"), value = JsonPrimitive(maximumBase))
        else SheetPatch(path = sheetPath("values", "hp", "max"), value = buildJsonObject { put("base", maximumBase); put("bonuses", JsonArray(emptyList())) })
    }
    return patches
}
