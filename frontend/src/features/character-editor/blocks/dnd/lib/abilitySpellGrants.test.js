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
  it('creates a readonly external spell with its source and casting ability', () => {
    const grants = abilitySpellGrantRows([ability], { lvl: { level: 1 } })
    expect(syncAbilityGrantedSpells([], grants)).toEqual([{
      id: 498,
      prepared: false,
      external_only: true,
      casting_ability: 4,
      casting_ability_source: 'ability',
      granted_by: [{ kind: 'ability', item_id: 4092, label: 'Природная иллюзия', casting_ability: 4 }],
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
      cast_level_source: 'ability',
      external_only: true,
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

  it('keeps a manually owned spell when its ability source disappears', () => {
    const withGrant = syncAbilityGrantedSpells([{ id: 498, prepared: false }], abilitySpellGrantRows([ability], { lvl: { level: 1 } }))
    expect(withGrant[0].external_only).toBeUndefined()
    const removed = syncAbilityGrantedSpells(withGrant, [])
    expect(removed).toEqual([{ id: 498, prepared: false }])
  })

  it('removes an external-only spell when the granting ability disappears', () => {
    const withGrant = syncAbilityGrantedSpells([], abilitySpellGrantRows([ability], { lvl: { level: 1 } }))
    expect(syncAbilityGrantedSpells(withGrant, [])).toEqual([])
  })

  it('clears an old ability override when the grant no longer defines it', () => {
    const entry = {
      id: 498,
      prepared: false,
      external_only: true,
      granted_by: [{ kind: 'ability', item_id: 4092, label: 'Природная иллюзия' }],
      casting_ability: 4,
      casting_ability_source: 'ability',
      slotless: true,
      slotless_source: 'ability',
      cast_level: 2,
      cast_level_source: 'ability',
    }
    const grants = [{
      spellId: 498,
      castingAbility: null,
      slotless: false,
      castLevel: null,
      source: { kind: 'ability', item_id: 4092, label: 'Природная иллюзия' },
    }]

    expect(syncAbilityGrantedSpells([entry], grants)).toEqual([{
      id: 498,
      prepared: false,
      external_only: true,
      granted_by: [{ kind: 'ability', item_id: 4092, label: 'Природная иллюзия' }],
    }])
  })
})
