package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

internal fun vtmFormInput(target: String, sheet: CharacterSheet): JsonObject =
    when (target.substringBefore(':')) {
        "vtm-health" ->
            buildJsonObject {
                (0..6).forEach {
                    put(
                        it.toString(),
                        sheet.values["health"].arrayValue().getOrNull(it) ?: JsonPrimitive(""),
                    )
                }
            }
        "vtm-blood" ->
            JsonObject(
                mapOf(
                    "current" to
                        (sheet.values["blood_pool"].objectValue()["current"] ?: JsonPrimitive(0)),
                    "max" to (sheet.values["blood_pool"].objectValue()["max"] ?: JsonPrimitive(20)),
                )
            )
        "vtm-list" ->
            buildJsonObject {
                val rows = sheet.values[target.substringAfter(':')].arrayValue()
                repeat(maxOf(5, rows.size)) { index ->
                    val row = rows.getOrNull(index).objectValue()
                    put("name$index", row.text("name"))
                    put("value$index", row["value"] ?: JsonPrimitive(0))
                }
            }
        else -> JsonObject(emptyMap())
    }

internal fun vtmFeaturePatches(form: SheetFormFields, sheet: CharacterSheet): List<SheetPatch> {
    val input = form.input
    val (key, value) =
        when (form.target.substringBefore(':')) {
            "vtm-health" ->
                "health" to
                    JsonArray(
                        (0..6).map { index ->
                            val kind = input.text(index.toString())
                            require(kind in setOf("", "bashing", "lethal", "aggravated"))
                            JsonPrimitive(kind)
                        }
                    )
            "vtm-blood" -> {
                val max = inputInteger(input, "max", 20, min = 1, max = 1000)
                "blood_pool" to
                    JsonObject(
                        sheet.values["blood_pool"].objectValue() +
                            mapOf(
                                "max" to JsonPrimitive(max),
                                "current" to
                                    JsonPrimitive(inputInteger(input, "current", max = max)),
                            )
                    )
            }
            "vtm-list" -> {
                val key = form.target.substringAfter(':')
                require(key in setOf("disciplines", "backgrounds"))
                val old = sheet.values[key].arrayValue()
                key to
                    JsonArray(
                        (0 until maxOf(5, old.size)).map { index ->
                            JsonObject(
                                old.getOrNull(index).objectValue() +
                                    mapOf(
                                        "name" to JsonPrimitive(input.text("name$index")),
                                        "value" to
                                            JsonPrimitive(
                                                inputInteger(input, "value$index", max = 5)
                                            ),
                                    )
                            )
                        }
                    )
            }
            else -> error("Неизвестная форма VTM.")
        }
    return listOf(SheetPatch(path = sheetPath("values", key), value = value))
}

@Composable
internal fun VtmFeatureFields(form: FeatureFormScope) {
    when (form.editor.fields.target.substringBefore(':')) {
        "vtm-health" ->
            listOf(
                    "Царапина",
                    "Травма",
                    "Ранение",
                    "Тяжёлое ранение",
                    "Изуродован",
                    "Искалечен",
                    "Недееспособен",
                )
                .forEachIndexed { index, label ->
                    form.Choice(
                        index.toString(),
                        label,
                        listOf(
                            "" to "Нет урона",
                            "bashing" to "/",
                            "lethal" to "X",
                            "aggravated" to "*",
                        ),
                    )
                }
        "vtm-blood" -> {
            form.NumberField("current", "Текущий запас крови")
            form.NumberField("max", "Максимум")
        }
        "vtm-list" ->
            repeat(
                maxOf(
                    5,
                    form.editor.baseline.values[form.editor.fields.target.substringAfter(':')]
                        .arrayValue()
                        .size,
                )
            ) { index ->
                form.TextField("name$index", "Название ${index+1}")
                form.Choice(
                    "value$index",
                    "Значение",
                    (0..5).map { it.toString() to it.toString() },
                )
            }
    }
}
