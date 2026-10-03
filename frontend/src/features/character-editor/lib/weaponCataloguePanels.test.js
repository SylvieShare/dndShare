import { expect, it } from 'vitest'
import { weaponCataloguePanels } from './weaponCataloguePanels'
const base = { id: 1448, typeId: 1, data: { notes: '<p>Метательное копьё.</p>', range_min: 30, range_max: 120 } }
const magic = { id: 284, typeId: 19, data: { desc: '<p>Линия молнии: 120 футов, Ловкость Сл 13.</p>', weapon: { base_item_id: 1448 }, attunement: 'none', weapon_uses: [{ key: 'lightning', title: 'Метнуть молнией' }] } }
it('shows ordinary javelin rules and distances directly from its own catalogue edition', () => {
  const panels = weaponCataloguePanels(base, { uid: 'plain' })
  expect(panels).toMatchObject([{ title: 'Свойства оружия', description: base.data.notes, requirements: ['Обычная дистанция: 30 футов.', 'Предельная дистанция: 120 футов.'] }])
  const revised = { ...base, data: { ...base.data, notes: '<p>Замедляет на 10 футов.</p>', mastery: 'Замедляющее' } }
  expect(weaponCataloguePanels(revised, { uid: 'revised' })[0]).toMatchObject({ title: 'Свойства и искусность', description: revised.data.notes })
})
it('exposes lightning throw before an attack, preserving both base and magical rules', () => {
  const panels = weaponCataloguePanels(magic, { uid: 'magic', item_id: 1448, magic_item_id: 284 }, base)
  expect(panels).toHaveLength(2)
  expect(panels[1]).toMatchObject({ title: 'Метнуть молнией', description: magic.data.desc })
})
it('respects attunement and lost magic while keeping the ordinary base readable', () => {
  const item = { ...magic, data: { ...magic.data, attunement: 'required' } }
  const entry = { uid: 'magic', params: { magic: { attuned: false } } }
  expect(weaponCataloguePanels(item, entry, base)).toHaveLength(1)
  entry.params.magic.attuned = true
  expect(weaponCataloguePanels(item, entry, base)).toHaveLength(2)
  entry.params.magic.lost = true
  expect(weaponCataloguePanels(item, entry, base)).toHaveLength(1)
})
it('hides expired or absent instances without modifying handbook data', () => {
  const before = structuredClone(magic)
  expect(weaponCataloguePanels(magic, { count: 0 }, base)).toEqual([])
  expect(weaponCataloguePanels(magic, { params: { creation: { expired: true } } }, base)).toEqual([])
  expect(magic).toEqual(before)
})
