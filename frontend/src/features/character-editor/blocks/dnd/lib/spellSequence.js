import { spellInstances } from './spellScaling'

export function hasSpellSequence(item) {
  const rule = item?.data?.damage
  const trigger = rule?.attack_chain?.trigger
  return !!rule?.roll_table || ['matching_damage', 'matching_dice', 'odd_attack', 'always'].includes(trigger)
}

export function spellSequence(item, attack, parameters) {
  const rule = item.data?.damage
  if (!hasSpellSequence(item)) return {}
  return { sequence: {
    range: item.data.range?.distance, table: rule.roll_table || null, chain: rule.attack_chain || null,
    ...parameters, baseLevel: Number(item.data.lvl) || 0, castLevel: parameters.castLevel ?? (Number(item.data.lvl) || 0),
    instances: spellInstances(item, parameters.castLevel, parameters.charLevel),
    projectile: 1, revision: 0, hits: [{ attack, status: 'target' }],
  } }
}
