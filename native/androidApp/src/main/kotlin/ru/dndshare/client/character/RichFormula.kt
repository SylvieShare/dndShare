package ru.dndshare.client.character

import kotlin.math.*

data class RichFormulaResult(val value: Double?, val variables: Set<String>)

val richFormulaVariables =
    linkedMapOf(
        "casting_mod" to "Модификатор заклинательной характеристики",
        "prof_bonus" to "Бонус мастерства",
        "char_level" to "Уровень персонажа",
        "cast_level" to "Круг заклинания",
        "spell_dc" to "Сл заклинания",
        "spell_attack" to "Бонус атаки заклинанием",
        "str_mod" to "Модификатор Силы",
        "dex_mod" to "Модификатор Ловкости",
        "con_mod" to "Модификатор Телосложения",
        "int_mod" to "Модификатор Интеллекта",
        "wis_mod" to "Модификатор Мудрости",
        "cha_mod" to "Модификатор Харизмы",
    )

/** The same bounded arithmetic grammar used by rich descriptions in the web client. */
fun richFormula(formula: String, context: Map<String, Double> = emptyMap()): RichFormulaResult {
    val source = formula.trim().replace(Regex("[−–—]"), "-").replace('×', '*')
    val tokens =
        Regex("[0-9]+(?:\\.[0-9]+)?|[a-z_]+|[()+*/,\\-]").findAll(source).map { it.value }.toList()
    require(
        source.isNotEmpty() &&
            source.length <= 400 &&
            tokens.size <= 150 &&
            tokens.joinToString("") == source.filterNot(Char::isWhitespace)
    ) {
        "Некорректная формула."
    }
    var index = 0
    var missing = false
    val variables = linkedSetOf<String>()
    lateinit var sum: () -> Double
    fun atom(): Double {
        val token = tokens.getOrNull(index++) ?: error("Ожидается число или показатель.")
        if (token == "+" || token == "-") return (if (token == "-") -1 else 1) * atom()
        if (token == "(") {
            val value = sum()
            require(tokens.getOrNull(index++) == ")") { "Скобки не закрыты." }
            return value
        }
        token.toDoubleOrNull()?.let {
            return it
        }
        if (token in setOf("min", "max", "floor", "ceil")) {
            require(tokens.getOrNull(index++) == "(") { "После функции нужны скобки." }
            val args = mutableListOf(sum())
            while (tokens.getOrNull(index) == ",") {
                index++
                args.add(sum())
            }
            require(tokens.getOrNull(index++) == ")") { "Скобки не закрыты." }
            if (token == "floor" || token == "ceil")
                require(args.size == 1) { "Округление принимает одно значение." }
            return when (token) {
                "min" -> args.min()
                "max" -> args.max()
                "floor" -> floor(args[0])
                else -> ceil(args[0])
            }
        }
        require(token in richFormulaVariables) { "Неизвестный показатель в формуле." }
        variables.add(token)
        return context[token]?.takeIf { it.isFinite() }
            ?: run {
                missing = true
                0.0
            }
    }
    fun product(): Double {
        var value = atom()
        while (tokens.getOrNull(index) in listOf("*", "/")) {
            val operator = tokens[index++]
            val right = atom()
            value = if (operator == "*") value * right else value / right
        }
        return value
    }
    sum = {
        var value = product()
        while (tokens.getOrNull(index) in listOf("+", "-")) {
            val operator = tokens[index++]
            val right = product()
            value = if (operator == "+") value + right else value - right
        }
        value
    }
    val value = sum()
    require(index == tokens.size && (missing || value.isFinite())) {
        "Результат не является числом."
    }
    return RichFormulaResult(if (missing) null else value, variables)
}
