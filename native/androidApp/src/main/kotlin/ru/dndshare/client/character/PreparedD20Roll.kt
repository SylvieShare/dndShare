package ru.dndshare.client.character

import kotlin.random.Random
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

/**
 * Portable rules and already-rolled bonus dice. Server retry supplies only the same natural d20s.
 */
@Serializable
data class PreparedD20Roll(
    val request: SheetRollRequest,
    val mode: String,
    val flat: Int,
    val bonusDice: List<Int>,
    val bonusTotal: Int,
    val bonusParts: List<JsonObject>,
    val minimumRule: JsonObject? = null,
    val sources: List<String> = emptyList(),
    val bonusExpression: String = "",
)

fun prepareD20Roll(
    request: SheetRollRequest,
    derived: DndDerivedValues,
    selectedMode: String = request.manualMode,
    random: Random = Random.Default,
): PreparedD20Roll {
    require(request.formula == null)
    val (effects, names) = rollEffects(derived, request)
    val scope = if (request.kind == "skill_check") "ability_check" else request.kind
    val minimum =
        combatRules(derived.sheet, derived.items, "roll_adjustments")
            .filter { rule ->
                rule.text("kind") == "minimum_natural" &&
                    (rule.text("scope").isBlank() || rule.text("scope") == scope) &&
                    (rule["scopes"].arrayValue().isEmpty() ||
                        rule["scopes"].arrayValue().any { it.jsonPrimitive.content == scope }) &&
                    request.proficiencyRank >= rule["minimum_proficiency_rank"].number()
            }
            .maxByOrNull { it["value"].number() }
    val context = request.ruleContext().copy(kind = scope)
    val bonuses =
        derived.rules("roll_bonus", context).filter {
            it.rule.text("key") !in request.excludedBonuses && it.rule.text("formula").isNotBlank()
        }
    val rolls = bonuses.map { rollDice(it.rule.text("formula"), random) }
    val exhaustion =
        if (derived.sheet.sourceVersion == "2024")
            2 * derived.sheet.values["exhaustion"].objectValue()["level"].number()
        else 0
    return PreparedD20Roll(
        request,
        automaticRollMode(selectedMode, effects),
        request.bonus - exhaustion,
        rolls.flatMap { it.dice },
        rolls.sumOf { it.total },
        rolls.flatMap { it.parts },
        minimum,
        names +
            bonuses.map { it.sourceLabel.ifBlank { "Бонус" } + ": " + it.rule.text("formula") } +
            (if (exhaustion > 0) listOf("Истощение −$exhaustion") else emptyList()),
        bonuses.joinToString("+") { it.rule.text("formula") },
    )
}

fun resolvePreparedD20(plan: PreparedD20Roll, rolls: List<Int>): SheetRollResult {
    require(plan.mode in setOf("normal", "advantage", "disadvantage"))
    require(rolls.size == (if (plan.mode == "normal") 1 else 2) && rolls.all { it in 1..20 })
    val selected = if (plan.mode == "disadvantage") rolls.min() else rolls.max()
    val kept = rolls.indexOf(selected)
    val rule = plan.minimumRule?.takeIf { it["value"].number() > selected }
    val keptValue = rule?.get("value")?.number() ?: selected
    val first = buildJsonObject {
        put("kind", "dice")
        put("operator", "+")
        put("sign", "+")
        put("n", rolls.size)
        put("sides", 20)
        put("rolls", JsonArray(rolls.map(::JsonPrimitive)))
        put("sum", keptValue)
        put("label", JsonNull)
        put("color", JsonNull)
        if (plan.mode != "normal") {
            put("keptIndex", kept)
            put("dropped", JsonArray(rolls.indices.filter { it != kept }.map(::JsonPrimitive)))
        }
    }
    val flat =
        if (plan.flat == 0) emptyList()
        else
            listOf(
                buildJsonObject {
                    put("kind", "flat")
                    put("operator", if (plan.flat < 0) "-" else "+")
                    put("sign", if (plan.flat < 0) "-" else "+")
                    put("value", kotlin.math.abs(plan.flat))
                    put("sum", kotlin.math.abs(plan.flat))
                    put("label", JsonNull)
                    put("color", JsonNull)
                }
            )
    val adjustments =
        rule
            ?.let {
                listOf(
                    buildJsonObject {
                        put("kind", "minimum_natural")
                        put(
                            "label",
                            it.text("label").ifBlank {
                                it.text("source_label").ifBlank { "Корректировка броска" }
                            },
                        )
                        put("original", selected)
                        put("value", keptValue)
                    }
                )
            }
            .orEmpty()
    val total = keptValue + plan.flat + plan.bonusTotal
    val expression =
        ("${rolls.size}d20" +
                (if (plan.flat >= 0) "+" else "") +
                plan.flat +
                (if (plan.bonusExpression.isBlank()) "" else "+" + plan.bonusExpression))
            .replace("+-", "-")
    return SheetRollResult(
        plan.request.title,
        plan.mode,
        rolls,
        selected,
        plan.flat + plan.bonusTotal,
        plan.bonusDice,
        total,
        plan.sources + adjustments.map { it.text("label") + ": " + selected + " → " + keptValue },
        listOf(first) + plan.bonusParts + flat,
        listOf(
            buildJsonObject {
                put("label", JsonNull)
                put("color", JsonNull)
                put("value", total)
            }
        ),
        expression,
        adjustments,
    )
}
