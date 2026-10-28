package ru.dndshare.client.ui.character

import java.util.UUID
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.CatalogueItem

enum class SheetNumberField {
    Current,
    Temporary,
    Maximum,
    Exhaustion,
}

@Serializable
data class SheetFormFields(
    val id: String,
    val target: String,
    val number: String,
    val temp: String,
    val maximum: String,
    val exhaustion: String,
    val inspiration: Boolean,
    val selected: List<Long>,
    val error: String? = null,
    val input: JsonObject = JsonObject(emptyMap()),
    val diskInputs: Boolean = false,
)

data class SheetEditorState(
    val fields: SheetFormFields,
    val baseline: CharacterSheet,
    val saving: Boolean = false,
    val commandPending: Boolean = false,
    val commandBusy: Boolean = false,
)

internal fun initialForm(
    target: String,
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem> = emptyMap(),
    sessionUuid: String? = null,
): SheetFormFields {
    val hp = sheet.values["hp"].objectValue()
    val maximum = hp["max"]
    val stat = sheet.values[target].objectValue()["value"]
    val initial =
        when {
            target == "hp" -> hp["current"].number()
            target.startsWith("vtm:") -> sheet.values[target.split(':')[1]].number()
            stat is JsonObject -> stat["base"].number(10)
            else -> stat.number(10)
        }
    return SheetFormFields(
        UUID.randomUUID().toString(),
        target,
        initial.toString(),
        hp["temp"].number().toString(),
        (if (maximum is JsonObject) maximum["base"].number() else maximum.number()).toString(),
        sheet.values["exhaustion"].objectValue()["level"].number().toString(),
        sheet.values["inspiration"] == JsonPrimitive(true),
        sheet.values["states"].arrayValue().mapNotNull {
            it.objectValue()["effect_id"].referenceId()
        },
        input =
            if (isCommandForm(target)) initialCommandInput(target, sheet, items, sessionUuid)
            else if (target == "hp")
                JsonObject(
                    hp + ("bonuses" to (maximum.objectValue()["bonuses"] ?: JsonArray(emptyList())))
                )
            else if (dndAbilities.any { it.id == target }) initialStatInput(target, sheet)
            else initialFeatureInput(target, sheet, items),
    )
}

internal fun formPatches(
    form: SheetFormFields,
    baseline: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    metadata: ru.dndshare.client.model.HandbookMetadata =
        ru.dndshare.client.model.HandbookMetadata(),
): List<SheetPatch> {
    fun nonNegative(text: String) =
        text.toIntOrNull()?.takeIf { it >= 0 } ?: error("Введите целое неотрицательное число.")
    return when {
        isFeatureForm(form.target) -> featureFormPatches(form, baseline, items, metadata)
        form.target == "hp" -> {
            val patches =
                baseline.hpPatches(
                    nonNegative(form.number),
                    nonNegative(form.temp),
                    nonNegative(form.maximum),
                )
            val projected = baseline.copy(data = applySheetPatches(baseline.data, patches))
            val hp = projected.values["hp"].objectValue()
            val updated =
                JsonObject(
                    hp +
                        buildJsonObject {
                            for (key in listOf("ds_success", "ds_failure")) if (
                                form.input[key] != null
                            )
                                put(key, inputInteger(form.input, key, max = 3))
                            if (form.input["bonuses"] != null)
                                put(
                                    "max",
                                    JsonObject(
                                        hp["max"].objectValue() +
                                            ("bonuses" to validatedBonuses(form.input["bonuses"]))
                                    ),
                                )
                        }
                )
            listOf(SheetPatch(path = sheetPath("values", "hp"), value = updated))
        }
        form.target == "statuses" -> {
            val level = nonNegative(form.exhaustion)
            require(level <= 6) { "Уровень истощения: от 0 до 6." }
            buildList {
                addAll(statusFormPatches(form, baseline, items))
                if (level != baseline.values["exhaustion"].objectValue()["level"].number()) {
                    add(
                        if (baseline.values["exhaustion"] is JsonObject)
                            SheetPatch(
                                path = sheetPath("values", "exhaustion", "level"),
                                value = JsonPrimitive(level),
                            )
                        else
                            SheetPatch(
                                path = sheetPath("values", "exhaustion"),
                                value = buildJsonObject { put("level", level) },
                            )
                    )
                }
                if (form.inspiration != (baseline.values["inspiration"] == JsonPrimitive(true)))
                    add(
                        SheetPatch(
                            path = sheetPath("values", "inspiration"),
                            value = JsonPrimitive(form.inspiration),
                        )
                    )
            }
        }
        form.target.startsWith("vtm:") -> {
            val key = form.target.split(':')[1]
            val value = nonNegative(form.number)
            val maximum =
                if (key.startsWith("xp_")) Int.MAX_VALUE
                else if (key in setOf("humanity", "willpower_perm", "willpower_temp")) 10 else 5
            require(value <= maximum) { "Максимум: $maximum." }
            listOf(SheetPatch(path = sheetPath("values", key), value = JsonPrimitive(value)))
        }
        else -> statFormPatches(form, baseline)
    }
}
