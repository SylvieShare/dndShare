package ru.dndshare.client.ui.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text

internal fun initialStatInput(target: String, sheet: CharacterSheet): JsonObject {
    val stat = sheet.values[target].objectValue()
    return buildJsonObject { put("bonuses", stat["value"].objectValue()["bonuses"] ?: JsonArray(emptyList())) }
}

internal fun statFormPatches(form: SheetFormFields, sheet: CharacterSheet): List<SheetPatch> {
    val value =
        form.number.toIntOrNull()?.takeIf { it >= 0 }
            ?: error("Введите целое неотрицательное значение характеристики.")
    val original = sheet.values[form.target].objectValue()
    val input = form.input
    val modes = setOf("auto", "normal", "advantage", "disadvantage")
    fun mode(raw: JsonElement?): JsonPrimitive {
        val text = (raw as? JsonPrimitive)?.content.orEmpty().ifBlank { "auto" }
        require(text in modes) { "Неизвестный режим броска." }
        return JsonPrimitive(text)
    }
    val stat = original.toMutableMap()
    stat["value"] =
        JsonObject(
            original["value"].objectValue() +
                mapOf(
                    "base" to JsonPrimitive(value),
                    "bonuses" to
                        validatedBonuses(
                            input["bonuses"] ?: original["value"].objectValue()["bonuses"]
                        ),
                )
        )
    input["save_up"]?.let { stat["save_up"] = JsonPrimitive(it == JsonPrimitive(true)) }
    input["save_bonuses"]?.let { stat["save_bonuses"] = validatedBonuses(it) }
    for (key in listOf("check_roll_mode", "save_roll_mode")) input[key]?.let {
        stat[key] = mode(it)
    }
    input["skills"]?.let { skills ->
        stat["skills"] =
            JsonObject(
                skills.objectValue().mapValues { (_, raw) ->
                    val row = raw.objectValue()
                    JsonObject(
                        row +
                            mapOf(
                                "up" to JsonPrimitive(inputInteger(row, "up", max = 2)),
                                "bonuses" to validatedBonuses(row["bonuses"]),
                                "roll_mode" to mode(row["roll_mode"]),
                            )
                    )
                }
            )
    }
    return listOf(SheetPatch(path = sheetPath("values", form.target), value = JsonObject(stat)))
}

internal val rollModeOptions =
    listOf(
        "auto" to "Автоматически",
        "normal" to "Обычно",
        "advantage" to "Преимущество",
        "disadvantage" to "Помеха",
    )
