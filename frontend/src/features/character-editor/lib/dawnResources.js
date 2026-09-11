import { advanceItemUseCooldowns } from './itemUseCooldowns'
import { advanceSelectedTargets } from './selectedTarget'
import { rollDiceExpression } from '@/shared/lib/dice'
import { FEATURE_VALUE_IDS } from './characterMagicItems'
import { createAbilityResourceSource } from './characterResources'

export function validDawnFormula(value) {
  const formula = String(value || '').replace(/\s/g, '').replace(/[кКD]/g, 'd')
  if (!/^(?:\d*d\d+|\d+)(?:\+(?:\d*d\d+|\d+))*$/.test(formula)) return false
  return formula.split('+').every(term => {
    if (!term.includes('d')) return Number(term) <= 10000
    const [count, sides] = term.split('d').map((v, i) => Number(v || (i ? 0 : 1)))
    return count >= 1 && count <= 100 && sides >= 2 && sides <= 1000
  })
}

export function dawnResources(values, itemsById) {
  return FEATURE_VALUE_IDS.flatMap(valueId => {
    const source = createAbilityResourceSource(valueId)
    return source.collect(values, itemsById, { includeInactive: true })
      .filter(row => ['full', 'roll'].includes(row.dawn_recovery?.mode))
      .map(row => ({ ...row, adapter: source }))
  })
}

/** One sunrise restores every eligible instance, including items stored in a bag. */
export function restoreDawnResources(values, itemsById, roll = rollDiceExpression) {
  const resources = dawnResources(values, itemsById)
  if (resources.some(row => row.dawn_recovery.mode === 'roll' && !validDawnFormula(row.dawn_recovery.formula))) {
    return { patch: {}, results: [], error: 'В правиле рассвета указана некорректная формула. Исправьте её в редакторе источника.' }
  }
  const patch = {}, results = []
  let next = values
  for (const resource of resources) {
    if (resource.value >= resource.total) continue
    const formula = resource.dawn_recovery.mode === 'roll' ? resource.dawn_recovery.formula : null
    const rolled = formula ? Math.max(0, Number(roll(formula)?.total) || 0) : resource.total - resource.value
    const available = Math.min(resource.total, resource.value + rolled)
    const update = resource.adapter.setAvailable(next, resource, available, itemsById)
    Object.assign(patch, update); next = { ...next, ...update }
    results.push({ key: resource.key, title: resource.title, before: resource.value, after: available, total: resource.total, formula, rolled })
  }
  const targets = advanceSelectedTargets(next, itemsById)
  Object.assign(patch, targets.patch)
  const cooldowns = advanceItemUseCooldowns({ ...next, ...targets.patch }, itemsById)
  Object.assign(patch, cooldowns.patch)
  return { patch, results, targets: targets.results, cooldowns: cooldowns.results, error: '' }
}
