import { expect, it } from 'vitest'
import { weaponBlockResources } from './weaponBlockResources'
const resource = (key = '') => ({ key: 'pool:' + key, value: 2, total: 3, source: { resourceKey: key } })
it('places the mace terror stock in its related effects block', () => {
  const pool = resource(), data = { status_effects: [{ key: 'terror' }], feature_actions: [{ key: 'terror', uses_resource: true, resource_cost: 1 }] }
  const result = weaponBlockResources({ data }, [pool])
  expect(result.effects).toEqual([pool]); expect(result.actions).toEqual([]); expect(result.unassigned).toEqual([])
})
it('places lightning javelin stock only in its special use', () => {
  const pool = resource(), result = weaponBlockResources({ data: { weapon_uses: [{ key: 'lightning_throw', resource_cost: 1 }] } }, [pool])
  expect(result.uses.lightning_throw).toEqual([pool]); expect(result.effects).toEqual([]); expect(result.unassigned).toEqual([])
})
it('keeps confirmed uses and authored properties on their own independent resources', () => {
  const luck = resource('luck'), spells = resource()
  const result = weaponBlockResources({ data: { confirmed_uses: [{ key: 'luck', resource_key: 'luck' }], weapon_notes: [{ key: 'spells', resource_key: '' }] } }, [luck, spells])
  expect(result.confirmed.luck).toEqual([luck]); expect(result.notes.spells).toEqual([spells]); expect(result.unassigned).toEqual([])
})
it('shows charged damage or actions when they own the remaining pool', () => {
  expect(weaponBlockResources({ data: { weapon_damage: [{ key: 'strike', label: 'Мощный удар', uses_resource: true }] } }, [resource()]).damage).toHaveLength(1)
  expect(weaponBlockResources({ data: { feature_actions: [{ key: 'command', title: 'Управление рыбами', resource_cost: 1 }] } }, [resource()]).actions).toHaveLength(1)
})
it('does not assign a pool twice or infer a resource for a curse', () => {
  const pool = resource(), result = weaponBlockResources({ data: { weapon_notes: [{ key: 'curse', kind: 'curse' }], weapon_uses: [{ key: 'throw', resource_cost: 1 }], status_effects: [{ key: 'effect' }] } }, [pool])
  expect(result.uses.throw).toEqual([pool]); expect(result.notes.curse).toBeUndefined(); expect(result.effects).toEqual([])
})
it('reports unattached pools for catalogue validation instead of inventing a generic charge block', () => {
  expect(weaponBlockResources({ data: { max_use: 10 } }, [resource()]).unassigned).toHaveLength(1)
})
