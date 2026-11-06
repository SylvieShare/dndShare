import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useWeaponCalc } from '@/features/character-editor/blocks/dnd/composables/useWeaponCalc'
import { abilityModifiersBySuggest } from '@/features/character-editor/blocks/dnd/lib/weaponAbility'
import cases from '../../../native/fixtures/game-mechanics/derived-rules.json'
import links from '../../../native/fixtures/game-mechanics/feature-links.json'
import { collectCharacterDefenses } from '@/features/character-editor/lib/characterDefenses'
import { collectCharacterSpellModifiers } from '@/features/character-editor/lib/characterSpellModifiers'
import { collectCharacterHpBonuses } from '@/features/character-editor/lib/characterHitPoints'
import { collectCharacterPassiveEffects } from '@/features/character-editor/lib/characterPassiveEffects'
import { collectCharacterCombatEffects, extraCriticalWeaponDice, matchingRollAdjustments, matchingWeaponDamageActions } from '@/features/character-editor/lib/characterCombatEffects'
import { derivedKinds } from '@/features/items/editor/abilityDependencyManifest'
import {
  collectCharacterDerivedEffects, derivedActivityBlocks, derivedArmorRules, derivedCriticalThreshold,
  derivedGrantedProficiencies, derivedNumericBonus, derivedProficiency, derivedRollEffects,
  derivedSpeedBonuses, matchingDerivedEffects, speedRuleContext, totalSpeed,
} from '@/features/character-editor/lib/characterDerivedEffects'
import { statusValueProjection } from '@/features/character-editor/lib/statusValueProjection'
import { deriveEquippedArmor } from '@/features/character-editor/blocks/dnd/lib/equippedArmor'
import { resolveNumValue } from '@/shared/lib/dnd'

describe('каталожные правила на листе', () => {
  it('has a shared scenario for every derived result offered by the editor', () => {
    const kinds = cases.flatMap(row => row.items.flatMap(item => (item.data.derived_effects || []).map(rule => rule.kind)))
    expect([...new Set(kinds)].sort()).toEqual(Object.keys(derivedKinds).sort())
  })
  for (const row of [...cases, ...links]) {
    it(row.name, () => {
      const items = new Map(row.items.map(item => [String(item.id), item]))
      const values = statusValueProjection(row.values, items)
      const effects = collectCharacterDerivedEffects(values, items)
      const armor = deriveEquippedArmor(values, Object.fromEntries(items), () => [], derivedArmorRules(effects), derivedGrantedProficiencies(effects, 'armor_proficiency'))
      const combat = collectCharacterCombatEffects(values, items)
      for (const check of row.checks) {
        const { op, kind, at = {} } = check
        let actual
        switch (op) {
          case 'weaponExpression': {
            const entry = values.weapon[0], item = items.get(String(entry.item_id))
            const calc = useWeaponCalc({ statsVar: ref(abilityModifiersBySuggest(values)), profBonus: ref(2),
              diceMap: ref({}), diceDetailsMap: ref({}), damageTypeMap: ref({}), damageTypeDetailsMap: ref({}),
              item: () => item, propertyItems: () => [], itemBaseAttacks: () => item.data.attacks })
            actual = at.critical ? calc.criticalDamageExpression(entry) : calc.damageExpression(entry)
            break
          }
          case 'spell': {
            const rows = collectCharacterSpellModifiers(values, items).filter(rule => rule.spellId === String(at.spellId))
            actual = { range: rows.find(r => r.range)?.range || '', damageBonus: rows.reduce((n, r) => n + r.damageBonus, 0) }
            break
          }
          case 'defenses': actual = collectCharacterDefenses(values, items).map(r => `${r.kind}:${r.damage_type}`).sort(); break
          case 'hp': actual = resolveNumValue(values.hp.max) + collectCharacterHpBonuses(values, items).reduce((n, r) => n + r.value, 0); break
          case 'notes': actual = collectCharacterPassiveEffects(values, items).map(r => r.title); break
          case 'criticalDice': actual = extraCriticalWeaponDice(combat, at); break
          case 'weaponDice': actual = matchingWeaponDamageActions(combat, at).map(r => r.dice_count); break
          case 'adjust': actual = matchingRollAdjustments(combat, at.kind === 'skill_check' ? 'ability_check' : at.kind, { proficiencyRank: at.rank }).map(r => r.value); break
          case 'armor': actual = armor.total; break
          case 'score': actual = resolveNumValue(values[kind].value); break
          case 'speed': {
            const speed = derivedSpeedBonuses(effects, speedRuleContext(armor))
            actual = totalSpeed(values.speed, speed, armor.speedPenalty)
            break
          }
          case 'bonus': actual = derivedNumericBonus(effects, kind, values, at).total; break
          case 'rank': actual = derivedProficiency(effects, kind, at).rank; break
          case 'grants': actual = derivedGrantedProficiencies(effects, kind).map(r => String(r.targetId)); break
          case 'modes': actual = derivedRollEffects(effects, at).map(r => r.mode); break
          case 'formulas': actual = matchingDerivedEffects(effects, kind, at).map(r => r.formula); break
          case 'threshold': actual = derivedCriticalThreshold(effects, at); break
          case 'active': actual = kind === 'activity_block' ? derivedActivityBlocks(effects, at.kind).length > 0 : matchingDerivedEffects(effects, kind, at).length > 0; break
          default: throw new Error(op)
        }
        expect(actual, JSON.stringify(check)).toEqual(check.expect)
      }
    })
  }
})
