import { expect, it } from 'vitest'
import { itemInstancePresentation, selectedMagicBases } from './magicItemInstanceView'
const item = { id: 178, typeId: 19, name: 'Трезубец управления рыбами', coverImageUrl: '/magic.jpg', data: { desc: 'Описание магического предмета', weapon: { base_item_id: 58 }, treasure: { weight: 10 } } }
it('uses the actual weapon instance base even when the catalogue base changes', () => {
  const instance = { item_id: 49, magic_item_id: 178 }
  expect(selectedMagicBases(item, instance)[0]).toMatchObject({ kind: 'weapon', id: 49, item: { data: { weapon: { base_item_id: 49 } } } })
  expect(item.data.weapon.base_item_id).toBe(58)
  expect(selectedMagicBases(item, null)).toEqual([])
})
it('selects fixed and chosen armor bases only for owned instances', () => {
  const armor = { ...item, data: { armor_base: { allowed_base_item_ids: [12, 13] } } }
  expect(selectedMagicBases(armor, { params: { armor_base_item_id: 13 } })[0].id).toBe(13)
  expect(selectedMagicBases(armor, { params: {} })).toEqual([])
  expect(selectedMagicBases({ ...armor, data: { armor_base: { base_item_id: 12 } } }, { params: {} })[0].id).toBe(12)
})
it('preserves the magic presentation without mixing in weapon statistics', () => {
  const result = itemInstancePresentation(item, { item_id: 58, magic_item_id: 178, override: { name: 'Мой трезубец' }, desc: 'Личная заметка' })
  expect(result).toMatchObject({ name: 'Мой трезубец', coverImageUrl: '/magic.jpg', data: { desc: item.data.desc } })
  expect(result.data.attacks).toBeUndefined()
  expect(item.name).toBe('Трезубец управления рыбами')
})
