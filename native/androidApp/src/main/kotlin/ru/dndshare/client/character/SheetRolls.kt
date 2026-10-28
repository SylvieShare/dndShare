package ru.dndshare.client.character

import kotlin.random.Random
import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

fun automaticRollMode(manual: String, effects: List<String>): String {
    if (manual in setOf("normal", "advantage", "disadvantage")) return manual
    val advantage = "advantage" in effects
    val disadvantage = "disadvantage" in effects
    return if (advantage == disadvantage) "normal"
    else if (advantage) "advantage" else "disadvantage"
}

fun rollEffects(
    derived: DndDerivedValues,
    request: SheetRollRequest,
): Pair<List<String>, List<String>> {
    val tool = derived.items[request.sourceItemId]?.typeId == 14L && request.kind == "ability_check"
    val context =
        if (tool) request.ruleContext().copy(kind = "tool", target = null)
        else request.ruleContext()
    val rules = derived.rules("roll_mode", context)
    val modes = rules.map { it.rule.text("mode") }.toMutableList()
    val names = rules.map { it.sourceLabel.ifBlank { "Эффект" } }.toMutableList()
    if (
        request.skill == 4L &&
            derived.armor.body?.data?.get("stealth_disadvantage") == JsonPrimitive(true)
    ) {
        modes.add("disadvantage")
        names.add("Доспех: помеха Скрытности")
    }
    if (request.ability in listOf(1L, 2L)) {
        val armor =
            listOfNotNull(
                derived.armor.body,
                derived.armor.shield.takeIf { derived.sheet.sourceVersion != "2024" },
            )
        if (armor.any { !armorProficient(it, derived) }) {
            modes.add("disadvantage")
            names.add("Нет владения доспехом")
        }
    }
    val exhaustion = derived.sheet.values["exhaustion"].objectValue()["level"].number()
    if (
        derived.sheet.sourceVersion != "2024" &&
            ((exhaustion >= 1 &&
                request.kind in setOf("ability_check", "skill_check", "initiative")) ||
                exhaustion >= 3 && request.kind in setOf("saving_throw", "attack"))
    ) {
        modes.add("disadvantage")
        names.add("Истощение")
    }
    return modes to names.distinct()
}

fun rollSheet(
    request: SheetRollRequest,
    derived: DndDerivedValues,
    selectedMode: String = request.manualMode,
    natural: List<Int>? = null,
    random: Random = Random.Default,
): SheetRollResult {
    request.formula?.let { formula ->
        val result =
            if (request.damageTerms.isEmpty()) rollDice(formula, random)
            else rollDamageTerms(request.damageTerms, random)
        val minimum = request.minimumTotal
        val adjusted = minimum != null && result.total < minimum
        val total = if (adjusted) requireNotNull(minimum) else result.total
        val adjustments =
            if (adjusted)
                listOf(
                    buildJsonObject {
                        put("label", "Минимальный урон")
                        put("original", result.total)
                        put("value", total)
                    }
                )
            else emptyList()
        return SheetRollResult(
            request.title,
            "normal",
            result.dice,
            null,
            0,
            total = total,
            parts = result.parts,
            byType =
                if (adjusted)
                    listOf(
                        buildJsonObject {
                            put("label", JsonNull)
                            put("color", JsonNull)
                            put("value", total)
                        }
                    )
                else result.byType,
            expression = formula,
            adjustments = adjustments,
        )
    }
    val mode = automaticRollMode(selectedMode, rollEffects(derived, request).first)
    val rolls = natural ?: List(if (mode == "normal") 1 else 2) { random.nextInt(1, 21) }
    return resolvePreparedD20(prepareD20Roll(request, derived, selectedMode, random), rolls)
}

private fun rollDamageTerms(terms: List<SheetDamageTerm>, random: Random): DiceResult {
    val results = terms.map { term ->
        val rolled = rollDice(term.expression, random)
        rolled.copy(
            parts =
                rolled.parts.map {
                    JsonObject(
                        it +
                            mapOf(
                                "label" to
                                    (term.label.takeIf(String::isNotBlank)?.let(::JsonPrimitive)
                                        ?: JsonNull),
                                "color" to
                                    (term.color.takeIf(String::isNotBlank)?.let(::JsonPrimitive)
                                        ?: JsonNull),
                            )
                    )
                }
        )
    }
    val dice = results.flatMap { it.dice }
    require(dice.size <= 2000) { "В одном броске допускается до 2000 костей." }
    val parts = results.flatMap { it.parts }
    val total = results.sumOf { it.total }
    val grouped = results.zip(terms).groupBy { it.second.label }
    val types = grouped.map { (label, rows) ->
        buildJsonObject {
            put("label", label.takeIf(String::isNotBlank)?.let(::JsonPrimitive) ?: JsonNull)
            put(
                "color",
                rows.first().second.color.takeIf(String::isNotBlank)?.let(::JsonPrimitive)
                    ?: JsonNull,
            )
            put("value", rows.sumOf { it.first.total })
        }
    }
    return DiceResult(terms.joinToString("+") { it.expression }, dice, total, parts, types)
}
