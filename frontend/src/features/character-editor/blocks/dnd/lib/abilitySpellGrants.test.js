import { describe, expect, it } from 'vitest'

import { abilitySpellGrantRows, syncAbilityGrantedSpells } from './abilitySpellGrants'

const ability = {
  id: 4092,
  name: 'Природная иллюзия',
  data: {
    level: 1,
    granted_spells: [{ spell: { id: 498 }, level: 1, ability: 4 }],
  },
}

describe('ability spell grants', () => {
  it('creates an independent readonly grant with its source and casting ability', () => {
    const grants = abilitySpellGrantRows([ability], { lvl: { level: 1 } })
    expect(syncAbilityGrantedSpells([], grants)).toEqual([{
      key: 'ability:4092:spell:498',
      id: 498,
      casting_ability: 4,
      source: { kind: 'ability', item_id: 4092, label: 'Природная иллюзия', casting_ability: 4 },
    }])
  })

  it('unlocks later spells from owner level and marks innate casts slotless', () => {
    const drow = { id: 4087, name: 'Дроуская магия', data: {
      granted_spells: [
        { spell: { id: 511 }, level: 1, ability: 6 },
        { spell: { id: 627 }, level: 3, ability: 6, slotless: true, cast_level: 2 },
      ],
    } }
    expect(abilitySpellGrantRows([drow], { lvl: { level: 2 } }).map((row) => row.spellId)).toEqual([511])
    const rows = abilitySpellGrantRows([drow], { lvl: { level: 3 } })
    expect(syncAbilityGrantedSpells([], rows).find((entry) => entry.id === 627)).toMatchObject({
      casting_ability: 6,
      slotless: true,
      cast_level: 2,
      source: { kind: 'ability', item_id: 4087 },
    })
  })

  it('grants a spell selected through a configurable ability choice', () => {
    const cantrip = {
      id: 9,
      name: 'Заговор волшебника',
      data: { choices: [{ key: 'wizard_cantrip', grant_spells: true, casting_ability: 4 }] },
    }
    const rows = abilitySpellGrantRows([cantrip], {
      lvl: { level: 1 },
      abilities_race: [{ id: 9, choices: { wizard_cantrip: [777] } }],
    })
    expect(rows).toMatchObject([{ spellId: 777, castingAbility: 4, source: { item_id: 9 } }])
  })

  it('takes the spellcasting ability from a dependent class choice', () => {
    const initiate = {
      id: 10,
      name: 'Посвящённый в магию',
      data: { choices: [
        { key: 'magic_class', options: [{ value: 4014, label: 'Волшебник', casting_ability: 4 }] },
        { key: 'spell', grant_spells: true, casting_ability_choice_key: 'magic_class', slotless: true, cast_level: 1 },
      ] },
    }
    const rows = abilitySpellGrantRows([initiate], {
      lvl: { level: 1 },
      abilities_feats: [{ id: 10, choices: { magic_class: [4014], spell: [900] } }],
    })
    expect(rows).toMatchObject([{ spellId: 900, castingAbility: 4, slotless: true, castLevel: 1 }])
  })

  it('does not grant spells from a feat with unmet requirements', () => {
    expect(abilitySpellGrantRows([ability], {
      lvl: { level: 1 },
      abilities_feats: [{ id: 4092, requirements_met: false }],
    })).toEqual([])
  })

  it('keeps grants from other source kinds when an ability source disappears', () => {
    const manual = { key: 'custom:1', id: 498, source: { kind: 'custom', label: 'Домашнее правило' } }
    const withGrant = syncAbilityGrantedSpells([manual], abilitySpellGrantRows([ability], { lvl: { level: 1 } }))
    const removed = syncAbilityGrantedSpells(withGrant, [])
    expect(removed).toEqual([manual])
  })

  it('removes an external-only spell when the granting ability disappears', () => {
    const withGrant = syncAbilityGrantedSpells([], abilitySpellGrantRows([ability], { lvl: { level: 1 } }))
    expect(syncAbilityGrantedSpells(withGrant, [])).toEqual([])
  })

  it('replaces an ability grant when its optional overrides disappear', () => {
    const entry = {
      key: 'ability:4092:spell:498',
      id: 498,
      source: { kind: 'ability', item_id: 4092, label: 'Природная иллюзия' },
      casting_ability: 4,
      slotless: true,
      cast_level: 2,
    }
    const grants = [{
      spellId: 498,
      castingAbility: null,
      slotless: false,
      castLevel: null,
      source: { kind: 'ability', item_id: 4092, label: 'Природная иллюзия' },
    }]

    expect(syncAbilityGrantedSpells([entry], grants)).toEqual([{
      key: 'ability:4092:spell:498',
      id: 498,
      source: { kind: 'ability', item_id: 4092, label: 'Природная иллюзия' },
    }])
  })
})
