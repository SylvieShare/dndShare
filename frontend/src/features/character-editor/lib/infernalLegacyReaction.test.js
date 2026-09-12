import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { collectCharacterFeatureActions, featureActionResourceKeys, groupCharacterFeatureActions } from './characterFeatureActions'
import { collectCharacterResources, restoreCharacterResources, setCharacterResourceAvailable } from './characterResources'

const sql = readFileSync(new URL('../../../../../internal/store/schema/111_infernal_legacy_reaction.sql', import.meta.url), 'utf8')
const featureActions = JSON.parse(sql.split('$reaction$')[1])
const resourceSql = readFileSync(new URL('../../../../../internal/store/schema/35_ability_resource_catalog_audit.sql', import.meta.url), 'utf8')
const resourceRules = JSON.parse(resourceSql.match(/'Дьявольское наследие', '([^']+)'::jsonb/)[1])
const items = new Map([['1443', {
  id: 1443,
  name: 'Дьявольское наследие',
  data: { ...resourceRules, feature_actions: featureActions },
}]])
const character = level => ({
  lvl: { level },
  abilities_race: [{ id: 1443, uid: 'infernal-legacy' }],
})

describe('Infernal Legacy catalogue reaction', () => {
  it('unlocks at character level 3 and binds only Hellish Rebuke, leaving Darkness in resources', () => {
    expect(collectCharacterFeatureActions(character(2), items)).toEqual([])
    for (const level of [3, 5]) {
      const values = character(level)
      const resources = collectCharacterResources(values, items)
      const actions = collectCharacterFeatureActions(values, items, resources)
      expect(actions).toHaveLength(1)
      expect(groupCharacterFeatureActions(actions).map(group => group.value)).toEqual(['reaction'])
      expect(actions[0]).toMatchObject({
        title: 'Адское возмездие', readonly: true, resource_cost: 1,
        resource: { total: 1, value: 1, long_rest: true, source: { resourceKey: 'hellish_rebuke' } },
      })
      const bound = featureActionResourceKeys(values, items, resources)
      expect(resources.filter(resource => !bound.has(resource.key)).map(resource => resource.source.resourceKey))
        .toEqual(level >= 5 ? ['darkness'] : [])
    }
  })

  it('spends the existing charge, preserves Darkness, and recovers only after a long rest', () => {
    const values = character(5)
    const resources = collectCharacterResources(values, items)
    const [action] = collectCharacterFeatureActions(values, items, resources)
    const spent = { ...values, ...setCharacterResourceAvailable(values, items, action.resource.key, 0) }
    expect(collectCharacterResources(spent, items).map(resource => resource.value)).toEqual([0, 1])
    expect(collectCharacterFeatureActions(spent, items, collectCharacterResources(spent, items))[0].resource.value).toBe(0)
    expect(restoreCharacterResources(spent, items, 'short').patch).toEqual({})
    const recovered = { ...spent, ...restoreCharacterResources(spent, items, 'long').patch }
    expect(collectCharacterResources(recovered, items).map(resource => resource.value)).toEqual([1, 1])
  })
})
