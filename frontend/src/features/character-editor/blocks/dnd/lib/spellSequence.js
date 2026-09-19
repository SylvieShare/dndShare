import { spellInstances } from './spellScaling'

export function spellSequence(item, attack, parameters) {
  const rule = item.data?.damage
  if (!rule?.roll_table && !rule?.attack_chain) return {}
  return { sequence: {
    range: item.data.range?.distance, table: rule.roll_table || null, chain: rule.attack_chain || null,
    ...parameters, instances: spellInstances(item, parameters.castLevel, parameters.charLevel),
    projectile: 1, revision: 0, hits: [{ attack, status: 'target' }],
  } }
}
