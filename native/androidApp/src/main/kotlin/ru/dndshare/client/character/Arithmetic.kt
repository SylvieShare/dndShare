package ru.dndshare.client.character

import kotlin.math.abs
import kotlin.math.floor

/** Bounded arithmetic for native calculators; never evaluates program source. */
fun arithmeticAmount(expression: String): Int =
    arithmeticLongAmount(expression, Int.MAX_VALUE.toLong()).toInt()

fun arithmeticLongAmount(expression: String, maximum: Long = 9_007_199_254_740_991L): Long {
    require(expression.length <= 200) { "Слишком длинное выражение." }
    val text = expression.replace('−', '-').filterNot(Char::isWhitespace)
    if (text.isEmpty()) return 0
    var position = 0
    var depth = 0
    lateinit var sum: () -> Double
    fun atom(): Double {
        require(++depth <= 30) { "Слишком много вложенных скобок." }
        val sign =
            when (text.getOrNull(position)) {
                '-' -> {
                    position++
                    -1
                }
                '+' -> {
                    position++
                    1
                }
                else -> 1
            }
        val result =
            if (text.getOrNull(position) == '(') {
                position++
                val value = sum()
                require(text.getOrNull(position) == ')') { "Проверьте скобки." }
                position++
                value
            } else {
                val start = position
                while (
                    text.getOrNull(position)?.let { it.isDigit() || it == '.' } == true
                ) position++
                text.substring(start, position).toDoubleOrNull() ?: error("Проверьте выражение.")
            }
        depth--
        return result * sign
    }
    fun product(): Double {
        var value = atom()
        while (text.getOrNull(position) in listOf('*', '/')) {
            val operator = text[position++]
            val operand = atom()
            if (operator == '/') require(operand != 0.0) { "Деление на ноль." }
            value = if (operator == '*') value * operand else value / operand
            require(value.isFinite() && abs(value) <= maximum) { "Слишком большое значение." }
        }
        return value
    }
    sum = {
        var value = product()
        while (text.getOrNull(position) in listOf('+', '-')) {
            val operator = text[position++]
            val operand = product()
            value = if (operator == '+') value + operand else value - operand
        }
        value
    }
    val value = sum()
    require(position == text.length && value.isFinite() && abs(value) <= maximum) {
        "Проверьте выражение."
    }
    val whole = floor(value)
    val rounded = abs(if (value - whole < .5) whole else whole + 1)
    require(rounded <= maximum) { "Слишком большое значение." }
    return rounded.toLong()
}
