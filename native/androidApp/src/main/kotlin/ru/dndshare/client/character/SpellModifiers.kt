package ru.dndshare.client.character

import ru.dndshare.client.model.text
import ru.dndshare.client.character.creation.creationStats

data class SpellModifiers(val damageBonus: Int, val range: String)

fun DndDerivedValues.spellModifiers(spellId: Long): SpellModifiers {
    var damageBonus = 0
    var range = ""
    for ((owner, rule, _, level) in ownedFeatureRules(sheet, items, "spell_modifiers")) {
        if (rule["spell_id"].referenceId() != spellId || level < owner.item.data["level"].number(1)) continue
        val ability = rule["damage_ability"].referenceId()
        if (ability != null && ability in 1L..6L) damageBonus += abilityModifier(score(creationStats[ability.toInt() - 1]))
        if (range.isBlank()) range = rule.text("range")
    }
    return SpellModifiers(damageBonus, range)
}
