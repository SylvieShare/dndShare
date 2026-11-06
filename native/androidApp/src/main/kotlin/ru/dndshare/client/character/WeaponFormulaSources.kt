package ru.dndshare.client.character

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import ru.dndshare.client.model.WireJson
import ru.dndshare.client.model.text

@Serializable
data class FormulaSource(val source: String, val expression: String)

internal fun WeaponReadout.baseFormulaSources(
    versatile: Boolean, critical: Boolean, omitPositiveAbility: Boolean = false,
): List<FormulaSource> = buildList {
    val terms = baseTerms(versatile, critical, extraDice = if (criticalDiceRules.isEmpty()) extraCriticalDice else 0)
    fun source(label: String, expression: String, term: SheetDamageTerm) {
        val tag = if (term.label.isBlank()) "" else "{${term.label}|${term.color}}"
        add(FormulaSource(label, expression + tag))
    }
    terms.forEach { source("Оружие", it.expression, it) }
    val first = terms.firstOrNull()
    val baseCount = if (versatile) twoHandedPartCount else basePartCount
    if (critical && baseCount > 0 && first != null && 'd' in first.expression) {
        for (rule in criticalDiceRules) {
            source(rule.text("source_label"), "${rule["extra_weapon_dice"].number()}d${first.expression.substringAfter('d')}", first)
        }
    }
    // weaponReadout emits a nonzero ability modifier first, before magic and features.
    addAll(if (omitPositiveAbility && statModifier > 0) damageSources.drop(1) else damageSources)
}

internal fun WeaponMenuHit.formulaSources(critical: Boolean): List<FormulaSource> {
    val stored = step[if (critical) "critical_sources" else "sources"]
    if (stored != null) runCatching { WireJson.decodeFromJsonElement<List<FormulaSource>>(stored) }.getOrNull()?.let { return it }
    val expression = step[if (critical) "critical_expression" else "expression"]?.jsonPrimitive?.content.orEmpty()
    val useName = event["title"]?.jsonPrimitive?.content ?: "Особое применение"
    // Legacy snapshots append the special die last, after the frozen base weapon formula.
    val extra = Regex("""[+-]?\d+d\d+(?:\{[^}]*\})?$""", RegexOption.IGNORE_CASE).find(expression)
        ?: return listOf(FormulaSource(useName, expression))
    return buildList {
        val base = expression.substring(0, extra.range.first)
        if (base.isNotEmpty()) add(FormulaSource("Оружие при применении", base))
        add(FormulaSource(useName, extra.value))
    }
}
