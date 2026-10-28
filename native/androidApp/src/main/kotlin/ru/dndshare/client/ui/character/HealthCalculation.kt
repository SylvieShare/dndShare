package ru.dndshare.client.ui.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

internal fun healthCalculation(
    form: SheetFormFields,
    baseline: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    kind: String,
    expression: String,
): SheetFormFields {
    require(kind in setOf("damage", "heal", "temp"))
    val amount = arithmeticAmount(expression)
    if (amount == 0) return form
    val current = form.number.toIntOrNull()?.takeIf { it >= 0 } ?: error("Проверьте текущие хиты.")
    val temp = form.temp.toIntOrNull()?.takeIf { it >= 0 } ?: error("Проверьте временные хиты.")
    val maxBase = form.maximum.toIntOrNull()?.takeIf { it >= 0 } ?: error("Проверьте базу хитов.")
    val max =
        maxBase +
            baseline.values["hp"].objectValue()["max"].objectValue()["bonuses"].bonusTotal() +
            featureHpBonus(baseline, items)
    val absorbed = if (kind == "damage") minOf(temp, amount) else 0
    val nextTemp =
        when (kind) {
            "damage" -> temp - absorbed
            "temp" -> Math.addExact(temp, amount)
            else -> temp
        }
    val nextCurrent =
        when (kind) {
            "damage" -> maxOf(0, current - (amount - absorbed))
            "heal" -> minOf(max, Math.addExact(current, amount))
            else -> current
        }
    val operations = form.input["hpOperations"].arrayValue()
    require(operations.size < 50) { "Сохраните текущие изменения, прежде чем продолжать расчёт." }
    val operation = buildJsonObject {
        put("kind", kind)
        put("amount", amount)
        put("absorbed", absorbed)
        put(
            "before",
            buildJsonObject {
                put("current", current)
                put("temp", temp)
                put("max", max)
            },
        )
        put(
            "after",
            buildJsonObject {
                put("current", nextCurrent)
                put("temp", nextTemp)
                put("max", max)
            },
        )
    }
    return form.copy(
        number = nextCurrent.toString(),
        temp = nextTemp.toString(),
        input =
            JsonObject(
                form.input +
                    mapOf(
                        "hpOperations" to JsonArray(operations + operation),
                        "hpRevision" to JsonPrimitive(form.input["hpRevision"].number() + 1),
                    )
            ),
    )
}
