import { describe, expect, it } from 'vitest'
import { collectCharacterFeatureWidgets } from './characterFeatureWidgets'

describe('character feature widgets', () => {
  it('resolves Sneak Attack dice from the owning class level', () => {
    const values = {
      lvl: { level: 5 },
      classes: [{ id: 4015, level: 5 }],
      abilities_class: [{ id: 68, uid: 'sneak' }],
    }
    const items = new Map([['68', {
      id: 68,
      name: 'Скрытая атака',
      data: {
        class_ids: [{ id: 4015 }],
        weapon_damage: [{ dice: 'd6', dice_count_level_divisor: 2, dice_count_rounding: 'up' }],
        sheet_widgets: [{
          key: 'sneak_attack',
          kind: 'metric',
          value_source: 'weapon_damage',
          details: ['Фехтовальное или дальнобойное оружие', 'Без помехи', ''],
        }],
      },
    }]])

    expect(collectCharacterFeatureWidgets(values, items)).toMatchObject([{
      key: 'sneak_attack',
      value: '3к6',
      dice: { count: 3, sides: 6, label: 'd6' },
      details: ['Фехтовальное или дальнобойное оружие', 'Без помехи'],
      active: false,
    }])
  })

  it('binds a toggle to its ability resource and active status', () => {
    const values = {
      lvl: { level: 3 },
      abilities_class: [{ id: 10, uid: 'rage' }],
      states: [{
        uid: 'status-rage',
        effect_id: 100,
        source: { kind: 'ability', item_id: 10, value_id: 'abilities_class', entry_key: 'rage', link_key: 'rage' },
      }],
    }
    const items = new Map([['10', {
      id: 10,
      name: 'Ярость',
      data: {
        scaling: [{ level: 1, value: '+2' }],
        status_effects: [{ key: 'rage', effect: { id: 100 } }],
        sheet_widgets: [{ key: 'rage', kind: 'toggle', value_source: 'scaling', status_effect_key: 'rage' }],
      },
    }]])
    const resources = [{ value: 2, total: 3, source: { valueId: 'abilities_class', entryKey: 'rage' } }]

    expect(collectCharacterFeatureWidgets(values, items, resources)[0]).toMatchObject({
      value: '+2', active: true, resource: { value: 2, total: 3 }, status_effect_link: { effect_id: 100 },
    })
  })

  it('treats a manually added linked effect as an active toggle', () => {
    const values = {
      lvl: { level: 3 },
      abilities_class: [{ id: 10, uid: 'rage' }],
      states: [{ uid: 'manual-rage', effect_id: 100, source: { kind: 'manual' } }],
    }
    const items = new Map([['10', {
      id: 10,
      name: 'Ярость',
      data: {
        status_effects: [{ key: 'rage', effect: { id: 100 } }],
        sheet_widgets: [{ key: 'rage', kind: 'toggle', status_effect_key: 'rage' }],
      },
    }]])

    expect(collectCharacterFeatureWidgets(values, items)[0].active).toBe(true)
  })
})
