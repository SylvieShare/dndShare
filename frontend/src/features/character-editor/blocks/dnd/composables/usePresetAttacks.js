import { computed } from 'vue'
import { itemEventData } from '@/features/character-editor/lib/sessionEventData'
import { improvisedWeaponAttackBonus, PRESET_ATTACK_ART_ITEM_IDS, presetDamageExpression, unarmedStrikeAttackBonus } from '../lib/presetAttacks'

export function usePresetAttacks(charCtx, { statsVar, profBonus, itemMap, attackMode, dice }) {
  const strengthModifier = computed(() => Number(statsVar.value['1']) || 0)
  const unarmedAttackBonus = computed(() => unarmedStrikeAttackBonus(strengthModifier.value, profBonus.value))
  const improvisedAttackBonus = computed(() => improvisedWeaponAttackBonus(strengthModifier.value))
  const effects = computed(() => charCtx.characterDerivedEffects?.bonus?.('weapon_damage_bonus', {
    kind: 'attack', abilitySuggestId: 1, weaponKind: 'melee',
  }))
  const damageBonus = computed(() => effects.value?.total || 0)
  const unarmedPresetItem = computed(() => itemMap.value[PRESET_ATTACK_ART_ITEM_IDS.unarmed] || null)
  const improvisedPresetItem = computed(() => itemMap.value[PRESET_ATTACK_ART_ITEM_IDS.improvised] || null)

  function definition(kind) {
    return kind === 'unarmed'
      ? { title: 'Рукопашный удар', attackBonus: unarmedAttackBonus.value }
      : { title: 'Импровизированное оружие', attackBonus: improvisedAttackBonus.value }
  }

  function presetMenuSummary(kind, options, scope) {
    const unarmed = kind === 'unarmed', parts = []
    if (scope === 'damage') {
      parts.push({ source: unarmed ? 'Рукопашный удар' : 'Оружие', expression: unarmed ? '1' : (options.critical ? '2d4' : '1d4') })
      for (const { source, value } of effects.value?.contributions || []) {
        if (value) parts.push({ source, expression: String(value) })
      }
      const raw = 1 + strengthModifier.value + damageBonus.value
      if (unarmed && raw < 0) parts.push({ source: 'Минимум урона', expression: String(-raw) })
    } else if (unarmed && profBonus.value) parts.push({ source: 'Владение', expression: String(profBonus.value) })
    if (strengthModifier.value) parts.push({ source: 'Сила', expression: String(strengthModifier.value) })
    return { parts, ability: 'Сила', bonus: definition(kind).attackBonus,
      mode: attackMode({ kind: 'attack', abilitySuggestId: 1, weaponKind: 'melee', weaponAttack: !unarmed }, options.attackRollMode) }
  }

  async function rollPresetAttack(kind, { attackRollMode = 'auto', excludedBonuses = [] } = {}) {
    const preset = definition(kind)
    const context = { kind: 'attack', abilitySuggestId: 1, weaponKind: 'melee', weaponAttack: kind !== 'unarmed' }
    const result = await dice.rollD20(`Атака: ${preset.title}`, preset.attackBonus, attackMode(context, attackRollMode), {
      roll_kind: 'attack',
      eventData: { ...itemEventData(kind === 'unarmed' ? unarmedPresetItem.value : improvisedPresetItem.value), attackRoll: true },
      crit_mode: true,
      critical_threshold: charCtx.characterDerivedEffects?.criticalThreshold?.(context) || 20,
      bonus_formula: charCtx.characterDerivedEffects?.rollBonus?.({ kind: 'attack' }, excludedBonuses),
      roll_triggers: charCtx.characterCombatEffects?.rollTriggers?.('attack') || [],
    })
    if (!result) return
    const states = charCtx.characterStatuses?.endOn?.('attack')
    if (charCtx.ownerMode && states) charCtx.updateValues({ states })
  }

  function rollPresetDamage(kind, critical = false) {
    const preset = definition(kind)
    dice.roll(`${critical ? 'Критический урон' : 'Урон'}: ${preset.title}`,
      presetDamageExpression(kind, strengthModifier.value, critical, damageBonus.value),
      { eventData: { damageRoll: true, ...itemEventData(kind === 'unarmed' ? unarmedPresetItem.value : improvisedPresetItem.value) } })
  }

  return { unarmedAttackBonus, improvisedAttackBonus, unarmedPresetItem, improvisedPresetItem, presetMenuSummary, rollPresetAttack, rollPresetDamage }
}
