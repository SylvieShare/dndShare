package ru.dndshare.client.ui.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

internal val statusDurationOptions =
    listOf(
        "manual" to "До ручного снятия",
        "rounds" to "Раунды",
        "minutes" to "Минуты",
        "hours" to "Часы",
        "days" to "Дни",
        "until_rest" to "До отдыха",
        "permanent" to "Постоянно",
        "custom" to "Особое условие",
    )

internal fun normalizedStatusRows(raw: List<JsonElement>): List<JsonObject> =
    raw.mapIndexed { index, value ->
        val row = value.objectValue()
        JsonObject(
            row +
                buildMap {
                    if (row.text("uid").isBlank())
                        put("uid", JsonPrimitive("status-${row["effect_id"].referenceId()}-$index"))
                }
        )
    }

private fun validatedDuration(raw: JsonObject): JsonObject {
    val kind = raw.text("kind").ifBlank { "manual" }
    require(statusDurationOptions.any { it.first == kind }) { "Выберите длительность эффекта." }
    return buildJsonObject {
        put("kind", kind)
        if (kind in setOf("rounds", "minutes", "hours", "days"))
            put("value", inputInteger(raw, "value", min = 1))
        if (kind == "custom") {
            val text = raw.text("text").trim()
            require(text.isNotBlank() && text.length <= 200) {
                "Укажите условие окончания до 200 символов."
            }
            put("text", text)
        }
    }
}

internal fun statusFormPatches(
    form: SheetFormFields,
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
): List<SheetPatch> {
    val selected =
        sheet.copy(
            data = applySheetPatches(sheet.data, selectedStatusPatches(sheet, form.selected, items))
        )
    val previous = normalizedStatusRows(selected.values["states"].arrayValue())
    val edits = form.input["statusEdits"].objectValue()
    var result: List<JsonElement> = previous.mapNotNull { row ->
        val edit = edits[row.text("uid")].objectValue()
        if (edit["remove"] == JsonPrimitive(true)) null
        else if (edit["duration"] is JsonObject)
            JsonObject(row + ("duration" to validatedDuration(edit["duration"].objectValue())))
        else row
    }
    for (raw in form.input["addedStatuses"].arrayValue()) {
        val original = raw.objectValue()
        val edit = edits[original.text("uid")].objectValue()
        if (edit["remove"] == JsonPrimitive(true)) continue
        val row =
            if (edit["duration"] is JsonObject)
                JsonObject(
                    original + ("duration" to validatedDuration(edit["duration"].objectValue()))
                )
            else original
        val effect =
            items[row["effect_id"].referenceId()]
                ?: error("Дождитесь загрузки добавленного эффекта.")
        result = addStatusInstance(result, effect, row)
    }
    result = withStatusEndEffects(previous, result, items)
    val before = sheet.values["states"].arrayValue()
    if (before == result) return emptyList()
    if (
        sheet.values["states"] !is JsonArray ||
            (before + result).any { it.objectValue().text("uid").isBlank() }
    )
        return listOf(SheetPatch(path = sheetPath("values", "states"), value = JsonArray(result)))
    fun path(row: JsonElement) =
        sheetPath("values", "states") + sheetSelector("uid", row.objectValue().getValue("uid"))
    return before
        .filter { old ->
            result.none { it.objectValue().text("uid") == old.objectValue().text("uid") }
        }
        .map { SheetPatch("remove", path(it)) } +
        result.mapNotNull { row ->
            val old = before.firstOrNull {
                it.objectValue().text("uid") == row.objectValue().text("uid")
            }
            when {
                old == null -> SheetPatch("insert", path(row), row)
                old != row -> SheetPatch(path = path(row), value = row)
                else -> null
            }
        }
}
