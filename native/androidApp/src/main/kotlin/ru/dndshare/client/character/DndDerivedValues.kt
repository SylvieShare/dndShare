package ru.dndshare.client.character

import kotlin.math.floor
import kotlinx.serialization.json.*
import ru.dndshare.client.model.CatalogueItem
import ru.dndshare.client.model.HandbookMetadata
import ru.dndshare.client.model.text

data class RuleContext(
    val kind: String = "",
    val ability: Long? = null,
    val skill: Long? = null,
    val target: JsonElement? = null,
    val proficient: Boolean = false,
    val armor: Boolean = false,
    val heavyArmor: Boolean = false,
    val shield: Boolean = false,
    val deferEquipment: Boolean = false,
    val weaponAttack: Boolean = false,
    val weaponKind: String = "",
    val improvised: Boolean = false,
)

private fun matches(source: OwnedDerivedRule, context: RuleContext): Boolean {
    val rule = source.rule
    val target = context.target?.jsonPrimitive?.content.orEmpty()
    if (rule.text("weapon_uid").let { it.isNotBlank() && it != target }) return false
    if (rule.text("excluded_weapon_uid").let { it.isNotBlank() && it == target }) return false
    if (rule["weapon_attacks_only"] == JsonPrimitive(true) && !context.weaponAttack) return false
    if (rule["forbid_improvised"] == JsonPrimitive(true) && context.improvised) return false
    if (
        rule.text("weapon_kind") in setOf("melee", "ranged") &&
            rule.text("weapon_kind") != context.weaponKind
    )
        return false
    val choiceKey = rule.text("choice_key")
    val selected = source.entry["choices"].objectValue()[choiceKey].arrayValue()
    val allowed = rule["choice_values"].arrayValue()
    if (
        choiceKey.isNotBlank() &&
            (selected.isEmpty() || allowed.isNotEmpty() && selected.none { it in allowed })
    )
        return false
    val targets = rule["target_ids"].arrayValue()
    if (targets.isNotEmpty() && (context.target == null || context.target !in targets)) return false
    if (rule["target_from_choice"] == JsonPrimitive(true)) {
        val target =
            context.skill?.toString()
                ?: context.ability?.toString()
                ?: context.target?.jsonPrimitive?.content
        val prefix =
            rule.text("choice_value_prefix").takeIf(String::isNotBlank)?.plus(":").orEmpty()
        if (target == null || selected.none { it.jsonPrimitive.content == prefix + target })
            return false
    }
    val scopes = rule["scopes"].arrayValue().map { it.jsonPrimitive.content }
    if (scopes.isNotEmpty() && context.kind !in scopes) return false
    val abilities = rule["ability_ids"].arrayValue().mapNotNull { it.referenceId() }
    if (abilities.isNotEmpty() && context.ability != null && context.ability !in abilities)
        return false
    val skills = rule["skill_ids"].arrayValue().mapNotNull { it.referenceId() }
    if (skills.isNotEmpty() && context.skill !in skills) return false
    if (!context.deferEquipment) {
        if (rule["requires_armor"] == JsonPrimitive(true) && !context.armor) return false
        if (rule["requires_no_armor"] == JsonPrimitive(true) && context.armor) return false
        if (rule["forbid_heavy_armor"] == JsonPrimitive(true) && context.heavyArmor) return false
        if (rule["allow_shield"] == JsonPrimitive(false) && context.shield) return false
    }
    if (rule["only_without_proficiency"] == JsonPrimitive(true) && context.proficient) return false
    return true
}

class DndDerivedValues(
    val sheet: CharacterSheet,
    val items: Map<Long, CatalogueItem>,
    val metadata: HandbookMetadata = HandbookMetadata(),
) {
    val effects = collectDerivedRules(sheet, items)

    fun rules(kind: String, context: RuleContext = RuleContext()) = effects.filter {
        it.rule.text("kind") == kind && matches(it, context)
    }

    fun score(id: String): Int {
        val ability = listOf("STR", "DEX", "CON", "INT", "WIS", "CHA").indexOf(id) + 1L
        return effects
            .filter {
                it.status &&
                    it.rule.text("kind") == "ability_minimum" &&
                    it.rule["ability_ids"].arrayValue().any { raw -> raw.referenceId() == ability }
            }
            .fold(sheet.statScore(id)) { best, rule -> maxOf(best, rule.rule["value"].number()) }
    }

    fun rank(kind: String, context: RuleContext): Int =
        rules(kind, context).maxOfOrNull { it.rule["rank"].number(1) } ?: 0

    fun bonus(kind: String, context: RuleContext): Int =
        rules(kind, context).sumOf { source ->
            val rule = source.rule
            var value = rule["value"].number()
            val ability = rule["ability_modifier"].number()
            if (ability in 1..6)
                value +=
                    abilityModifier(
                        score(listOf("STR", "DEX", "CON", "INT", "WIS", "CHA")[ability - 1])
                    )
            (rule["proficiency_multiplier"] as? JsonPrimitive)?.doubleOrNull?.let {
                value += floor(sheet.proficiency() * it).toInt()
            }
            if (rule["minimum"] != null) value = maxOf(value, rule["minimum"].number())
            value
        }

    fun hpMaximum(): Int = (sheet.hpMaximum() + featureHpBonus(sheet, items)).coerceAtLeast(0)

    val armor by lazy { armorReadout(this) }

    fun speed(): Int {
        val context =
            RuleContext(
                kind = "speed",
                armor = armor.body != null,
                heavyArmor = armor.body?.data?.text("category") == "heavy",
                shield = armor.shield != null,
            )
        val active = rules("speed_bonus", context)
        val ungrouped =
            active.filter { it.rule.text("group").isBlank() }.sumOf { it.rule["value"].number() }
        val grouped =
            active
                .filter { it.rule.text("group").isNotBlank() }
                .groupBy { it.rule.text("group") }
                .values
                .sumOf { group -> maxOf(0, group.maxOf { it.rule["value"].number() }) }
        val multiplier =
            maxOf(
                1.0,
                rules("speed_multiplier", context).maxOfOrNull {
                    (it.rule["value"] as? JsonPrimitive)?.doubleOrNull ?: 1.0
                } ?: 1.0,
            )
        val speed = sheet.values["speed"].objectValue()
        val exhaustion =
            if (sheet.sourceVersion == "2024")
                sheet.values["exhaustion"].objectValue()["level"].number() * 5
            else 0
        return (maxOf(
                0,
                speed["base"].number() + speed["bonuses"].bonusTotal() + ungrouped + grouped -
                    armor.speedPenalty -
                    exhaustion,
            ) * multiplier)
            .toInt()
    }
}
