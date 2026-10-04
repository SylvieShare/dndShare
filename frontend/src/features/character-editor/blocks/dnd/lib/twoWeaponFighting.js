import { matchingDerivedEffects } from '@/features/character-editor/lib/characterDerivedEffects'
import { isThrownWeapon } from './weaponThrow'

function hasProperty(item, properties, label) {
  return [...(Array.isArray(item?.data?.tags) ? item.data.tags : []), ...properties].some(property =>
    label.test(String(typeof property === 'object' ? property?.label || property?.value || property?.name || '' : property)))
}

/** Availability for this weapon; turn timing and the other weapon are checked by the player. */
export function twoWeaponFightingOption(entry, item, properties = [], effects = [], rulesVersion = '2014') {
  if (!item || entry.params?.creation?.expired || entry._improvisedThrow ||
    hasProperty(item, properties, /двуруч|two.hand/i)) return null
  if (entry._attackMode === 'thrown' && !isThrownWeapon(item, properties)) return null
  const ranged = !!item.data?.is_long_range
  if (rulesVersion === '2014' && ranged) return null
  const context = { kind: 'attack', targetId: entry.uid, weaponAttack: true,
    weaponKind: entry._attackMode === 'thrown' || ranged ? 'ranged' : 'melee' }
  const light = hasProperty(item, properties, /л[её]гк|light/i)
  const nonLight = matchingDerivedEffects(effects, 'two_weapon_non_light', context).length > 0
  if (!light && (!nonLight || ranged)) return null
  const modifierSources = matchingDerivedEffects(effects, 'two_weapon_damage_modifier', context)
  const hint = rulesVersion === '2024'
    ? 'Дополнительная атака другим оружием после атаки лёгким оружием в этот ход.'
    : 'Атака другим оружием в другой руке после действия «Атака» в этот ход. Оба оружия должны быть лёгкими, если нет «Мастера парного оружия».'
  return { addAbilityModifier: modifierSources.length > 0,
    hint: `${hint} ${modifierSources.length
      ? `Модификатор характеристики сохраняется: ${modifierSources.map(rule => rule.label || rule.source_label).join(', ')}.`
      : 'Положительный модификатор характеристики не добавляется; отрицательный и остальные бонусы сохраняются.'}` }
}
