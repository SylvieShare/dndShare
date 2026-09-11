import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { confirmedItemUses, confirmItemUse } from './confirmedItemUses'
import { initializeItemCharges } from '@/shared/lib/itemInitialCharges'
import { collectCharacterResources, restoreCharacterResources } from './characterResources'
import { restoreDawnResources } from './dawnResources'
import { createWeaponInstance, intrinsicWeaponBonus } from './magicWeapons'
import { fillMissingMagicBases } from './magicItemSettings'
const sql = readFileSync(new URL('../../../../../internal/store/schema/106_initial_item_charges.sql', import.meta.url), 'utf8')
const item = { id: 134, typeId: 19, name: 'Похититель девяти жизней', data: { weapon: { base_item_id: 49, magic_bonus: 2 }, attunement: 'required', initial_charges: { mode: 'roll', formula: '1к8+1' }, confirmed_uses: [JSON.parse(sql.split('$use$')[1])] } }
const items = new Map([['134', item]])
const make = () => ({ lvl: { level: 5 }, weapon: ['one', 'two'].map(uid => createWeaponInstance(item, { uid, item_id: 134, count: 1, params: initializeItemCharges({ magic: { attuned: true } }, 2) })) })
it('spends only after explicit confirmation on the right instance, stops at zero and retains +2', () => {
  let values = make()
  expect(confirmedItemUses(values, items, 'one')[0].error).toBe('')
  expect(values.weapon[0].params.magic.remaining).toBe(2)
  expect(confirmItemUse(values, items, 'one', 'life_stealing', false)).toEqual({})
  for (let i = 0; i < 2; i++) values = { ...values, ...confirmItemUse(values, items, 'one', 'life_stealing', true) }
  expect(values.weapon[0].params.magic).toMatchObject({ max_use: 2, remaining: 0, attuned: true })
  expect(values.weapon[1].params.magic.remaining).toBe(2)
  expect(intrinsicWeaponBonus(values.weapon[0], item, values)).toBe(2)
  expect(confirmItemUse(values, items, 'one', 'life_stealing', true)).toEqual({})
  expect(collectCharacterResources(values, items).map(r => r.value)).toEqual([0, 2])
  for (const kind of ['short', 'long']) {
    const result = restoreCharacterResources(values, items, kind)
    const restored = { ...values, ...result.patch }
    expect(restored.weapon[0].params.magic.remaining).toBe(0)
  }
  expect(restoreDawnResources(values, items).results).toEqual([])
})
it('preserves stock through reload and inventory movement and checks activation', () => {
  let values = make()
  values = JSON.parse(JSON.stringify({ ...values, ...confirmItemUse(values, items, 'one', 'life_stealing', true) }))
  const row = values.weapon.shift()
  values.items = { sections: [{ items: [row] }] }
  expect(confirmItemUse(values, items, 'one', 'life_stealing', true)).toEqual({})
  values.items = { equipped: [row] }
  expect(confirmedItemUses(values, items, 'one')[0].resource.value).toBe(1)
  row.params.magic.attuned = false
  expect(confirmedItemUses(values, items, 'one')).toEqual([])
})
it('does not invent charges for old instances and fills an absent base with configured charges', () => {
  const values = { items: { equipped: [{ uid: 'old', item_id: 134, params: { magic: { attuned: true } } }] } }
  expect(collectCharacterResources(values, items)).toEqual([])
  expect(confirmItemUse(values, items, 'old', 'life_stealing', true)).toEqual({})
  const unfixed = { ...item, data: { ...item.data, weapon: { allowed_base_item_ids: [49] } } }
  const patch = fillMissingMagicBases(values, unfixed, 'old', initializeItemCharges({ weapon_base_item_id: 49 }, 4))
  expect(patch.items.equipped[0]).toMatchObject({ uid: 'old', item_id: 49, magic_item_id: 134, params: { magic: { attuned: true, max_use: 4, remaining: 4 } } })
})
