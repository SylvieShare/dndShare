import { featureItemIds } from '@/features/character-editor/lib/characterMagicItems'
import { collectStatusDerivedEffects } from '@/features/character-editor/lib/characterStatuses'
import { collectCharacterDerivedEffects, derivedNumericBonus, derivedProficiency, derivedGrantedProficiencies, derivedRollEffects, matchingDerivedEffects } from '@/features/character-editor/lib/characterDerivedEffects'
import { deriveEquippedArmor } from '@/features/character-editor/blocks/dnd/lib/equippedArmor'
import { armorAbilityRollEffects, resolveRollMode } from '@/features/character-editor/blocks/dnd/lib/rollMode'
import { abilityModifier, proficiencyBonus, resolveNumValue, sumBonuses } from '@/shared/lib/dnd'

export const SAVE_ABILITIES = ['Сила', 'Ловкость', 'Телосложение', 'Интеллект', 'Мудрость', 'Харизма']
const keys = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
export const saveTargetKey = target => target.kind === 'npc' ? `npc:${target.encounterId}:${target.npcUid}` : `char:${target.charUuid}`
export function saveTargetItemIds(target) {
  const values = target.snapshot?.values || {}
  const states = target.kind === 'npc' ? target.snapshot?.combatant?.effectInstances : values.states
  return [...featureItemIds(values), ...(states || []).map(row => row.effect_id)].filter(Boolean)
}
export function sessionSaveProfile(target, ability, items, manualMode = 'auto', suggestItems = () => []) {
  const key = keys[ability - 1], context = { kind: 'saving_throw', abilitySuggestId: ability }
  const snapshot = target.snapshot || {}, values = snapshot.values || {}
  const npc = target.kind === 'npc', combatant = snapshot.combatant || {}, data = snapshot.item || {}
  const rules = npc ? collectStatusDerivedEffects({ states: combatant.effectInstances || [] }, items) : collectCharacterDerivedEffects(values, items)
  const stat = values[key] || {}
  const npcData = { ...data.stats, ...combatant.override }
  let score = npc ? Number(npcData[key?.toLowerCase()] ?? 10) : resolveNumValue(stat.value ?? 10)
  for (const rule of matchingDerivedEffects(rules, 'ability_minimum', context)) score = Math.max(score, Number(rule.value) || 0)
  let bonus = abilityModifier(score)
  if (npc) {
    const save = (combatant.override?.saving_throws || data.saving_throws)?.[key?.toLowerCase()]
    if (save != null && save !== '') bonus = Number(save) || 0
  } else {
    const mastery = values.prof_bonus || {}
    const prof = (mastery.auto === false ? Number(mastery.v) || 0 : proficiencyBonus(values.lvl?.level || 1)) + sumBonuses(mastery.bonuses)
    if (stat.save_up || derivedProficiency(rules, 'save_proficiency', context).rank) bonus += prof
    bonus += sumBonuses(stat.save_bonuses)
  }
  bonus += derivedNumericBonus(rules, 'save_bonus', values, context).total
  const armorModes = npc ? [] : armorAbilityRollEffects(deriveEquippedArmor(values, items, suggestItems, {}, derivedGrantedProficiencies(rules, 'armor_proficiency')), ability)
  const mode = resolveRollMode(manualMode === 'auto' ? stat.save_roll_mode || 'auto' : manualMode, [...derivedRollEffects(rules, context), ...armorModes])
  return { bonus, ...mode, formula: matchingDerivedEffects(rules, 'roll_bonus', context).map(rule => rule.formula).filter(Boolean).join(' + ') }
}
