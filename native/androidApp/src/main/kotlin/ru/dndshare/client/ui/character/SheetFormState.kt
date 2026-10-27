package ru.dndshare.client.ui.character

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.CatalogueItem
import java.util.UUID

enum class SheetNumberField { Current, Temporary, Maximum, Exhaustion }

@Serializable
data class SheetFormFields(
    val id: String, val target: String, val number: String, val temp: String,
    val maximum: String, val exhaustion: String, val inspiration: Boolean,
    val selected: List<Long>, val error: String? = null,
)

data class SheetEditorState(val fields: SheetFormFields, val baseline: CharacterSheet, val saving: Boolean = false)

internal fun initialForm(target: String, sheet: CharacterSheet): SheetFormFields {
    val hp = sheet.values["hp"].objectValue()
    val maximum = hp["max"]
    val stat = sheet.values[target].objectValue()["value"]
    val initial = when {
        target == "hp" -> hp["current"].number()
        target.startsWith("vtm:") -> sheet.values[target.split(':')[1]].number()
        stat is JsonObject -> stat["base"].number(10)
        else -> stat.number(10)
    }
    return SheetFormFields(UUID.randomUUID().toString(), target, initial.toString(), hp["temp"].number().toString(),
        (if (maximum is JsonObject) maximum["base"].number() else maximum.number()).toString(),
        sheet.values["exhaustion"].objectValue()["level"].number().toString(),
        sheet.values["inspiration"] == JsonPrimitive(true),
        sheet.values["states"].arrayValue().mapNotNull { it.objectValue()["effect_id"].referenceId() })
}

internal fun formPatches(form: SheetFormFields, baseline: CharacterSheet, items: Map<Long, CatalogueItem>): List<SheetPatch> {
    fun nonNegative(text: String) = text.toIntOrNull()?.takeIf { it >= 0 }
        ?: error("Введите целое неотрицательное число.")
    return when {
        form.target == "hp" -> baseline.hpPatches(nonNegative(form.number), nonNegative(form.temp), nonNegative(form.maximum))
        form.target == "statuses" -> {
            val level = nonNegative(form.exhaustion)
            require(level <= 6) { "Уровень истощения: от 0 до 6." }
            buildList {
                addAll(selectedStatusPatches(baseline, form.selected, items))
                if (level != baseline.values["exhaustion"].objectValue()["level"].number()) {
                    add(if (baseline.values["exhaustion"] is JsonObject)
                        SheetPatch(path = sheetPath("values", "exhaustion", "level"), value = JsonPrimitive(level))
                    else SheetPatch(path = sheetPath("values", "exhaustion"), value = buildJsonObject { put("level", level) }))
                }
                if (form.inspiration != (baseline.values["inspiration"] == JsonPrimitive(true)))
                    add(SheetPatch(path = sheetPath("values", "inspiration"), value = JsonPrimitive(form.inspiration)))
            }
        }
        form.target.startsWith("vtm:") -> listOf(SheetPatch(path = sheetPath("values", form.target.split(':')[1]), value = JsonPrimitive(nonNegative(form.number))))
        else -> listOf(baseline.manualStatPatch(form.target, nonNegative(form.number)))
    }
}
