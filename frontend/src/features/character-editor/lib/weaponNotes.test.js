import { expect, it } from 'vitest'
import { visibleWeaponNotes } from './weaponNotes'
const curse = { key: 'vengeance', kind: 'curse', when: 'attuned', title: 'Мстительный дух', description: '<p>Мудрость, Сл 15.</p>' }
const source = { id: 99, typeId: 19, data: { attunement: 'required', activation: 'equipped', weapon_notes: [curse] } }
const entry = { uid: 'sword', magic_item_id: 99, params: { magic: { attuned: true } } }
it('shows an attunement curse for that instance in weapons and while carried', () => {
  expect(visibleWeaponNotes(source, entry, true)).toEqual([curse])
  expect(visibleWeaponNotes(source, entry, false)).toEqual([curse])
  expect(visibleWeaponNotes(source, { ...entry, params: { magic: { attuned: false } } })).toEqual([])
  expect(visibleWeaponNotes(source, { uid: 'other-copy' })).toEqual([])
})
it('distinguishes active, attuned and carried visibility without leaking across instances', () => {
  const always = { ...curse, key: 'always', kind: 'rule', when: 'always' }, active = { ...curse, key: 'active', when: 'active' }
  const item = { ...source, data: { ...source.data, weapon_notes: [always, active, curse] } }
  expect(visibleWeaponNotes(item, entry, true)).toEqual([always, active, curse])
  expect(visibleWeaponNotes(item, entry, false)).toEqual([always, curse])
  expect(visibleWeaponNotes(item, { uid: 'copy' }, true)).toEqual([always])
})
it.each([{ count: 0 }, { params: { magic: { attuned: true, lost: true } } }, { params: { magic: { attuned: true }, creation: { expired: true } } }])('hides notes for unusable instances: %o', patch => {
  expect(visibleWeaponNotes(source, { ...entry, ...patch })).toEqual([])
})
