package ru.dndshare.client.character

import kotlin.random.Random
import kotlinx.serialization.json.*
import ru.dndshare.client.model.text

data class DiceResult(
    val formula: String,
    val dice: List<Int>,
    val total: Int,
    val parts: List<JsonObject> = emptyList(),
    val byType: List<JsonObject> = emptyList(),
)

fun rollDice(formula: String, random: Random = Random.Default): DiceResult =
    rollDice(formula) { sides -> random.nextInt(1, sides + 1) }

/** Bounded native parser; typed terms match the web chronicle wire format. */
fun rollDice(formula: String, die: (Int) -> Int): DiceResult {
    require(formula.length in 1..4000) { "Формула должна содержать от 1 до 4000 символов." }
    fun normalize(fragment: String) =
        fragment
            .replace(Regex("[‐‑‒–—―−﹣－]"), "-")
            .replace(Regex("[\\s\\p{Z}\\u200B\\uFEFF]"), "")
            .replace(Regex("[кКдДD]"), "d")
            .replace(Regex("[×xX]"), "*")
    val normalized = buildString {
        var offset = 0
        for (label in Regex("\\{[^}]*\\}").findAll(formula)) {
            append(normalize(formula.substring(offset, label.range.first)))
            append(label.value)
            offset = label.range.last + 1
        }
        append(normalize(formula.substring(offset)))
    }
    val source = if (normalized.firstOrNull() in listOf('+', '-')) normalized else "+$normalized"
    val pattern = Regex("([+\\-*])([0-9]*d[0-9]+|[0-9]+)(?:\\{([^|}]*)(?:\\|([^}]*))?\\})?")
    val dice = mutableListOf<Int>()
    val parts = mutableListOf<JsonObject>()
    var cursor = 0
    var product = 0L
    var total = 0L
    fun bounded(value: Long): Long {
        require(value in Int.MIN_VALUE.toLong()..Int.MAX_VALUE.toLong()) {
            "Слишком большой результат броска."
        }
        return value
    }
    for (match in pattern.findAll(source)) {
        require(match.range.first == cursor) { "Проверьте формулу броска." }
        cursor = match.range.last + 1
        val operator = match.groupValues[1]
        val body = match.groupValues[2]
        val label = match.groupValues[3].trim().takeIf(String::isNotEmpty)
        val color = match.groupValues[4].trim().takeIf(String::isNotEmpty)
        val rolls = mutableListOf<Int>()
        val sides: Int?
        val amount: Int
        if ('d' in body) {
            val count =
                body.substringBefore('d').ifBlank { "1" }.toIntOrNull()
                    ?: error("Слишком много костей.")
            sides = body.substringAfter('d').toIntOrNull() ?: error("Проверьте кость.")
            require(count in 1..2000 && sides in 2..1000 && dice.size + count <= 2000) {
                "Допустимо до 2000 костей d2–d1000."
            }
            repeat(count) {
                val value = die(sides)
                require(value in 1..sides) { "Некорректный результат кости." }
                dice.add(value)
                rolls.add(value)
            }
            amount = rolls.sum()
        } else {
            sides = null
            amount = body.toIntOrNull() ?: error("Слишком большое число.")
            require(amount <= 10_000) { "Число не должно превышать 10 000." }
        }
        parts.add(
            buildJsonObject {
                put("operator", operator)
                put("sign", if (operator == "*") "×" else operator)
                put("kind", if (sides == null) "flat" else "dice")
                put("label", label?.let(::JsonPrimitive) ?: JsonNull)
                put("color", color?.let(::JsonPrimitive) ?: JsonNull)
                if (sides == null) put("value", amount)
                else {
                    put("n", rolls.size)
                    put("sides", sides)
                    put("rolls", JsonArray(rolls.map(::JsonPrimitive)))
                }
                put("sum", amount)
            }
        )
        if (operator == "*") product = bounded(product * amount)
        else {
            total = bounded(total + product)
            product = if (operator == "-") -amount.toLong() else amount.toLong()
        }
    }
    require(cursor == source.length && parts.isNotEmpty()) { "Проверьте формулу броска." }
    val result = bounded(total + product).toInt()
    val byType =
        if (parts.any { it.text("operator") == "*" })
            listOf(
                buildJsonObject {
                    put("label", JsonNull)
                    put("color", JsonNull)
                    put("value", result)
                }
            )
        else {
            val groups = linkedMapOf<String, MutableList<JsonObject>>()
            parts.forEach { groups.getOrPut(it.text("label")) { mutableListOf() }.add(it) }
            groups.values.map { rows ->
                buildJsonObject {
                    put("label", rows.first()["label"] ?: JsonNull)
                    put(
                        "color",
                        rows.firstOrNull { it["color"] != JsonNull }?.get("color") ?: JsonNull,
                    )
                    put(
                        "value",
                        rows.sumOf { (if (it.text("sign") == "-") -1 else 1) * it["sum"].number() },
                    )
                }
            }
        }
    return DiceResult(formula, dice, result, parts, byType)
}
