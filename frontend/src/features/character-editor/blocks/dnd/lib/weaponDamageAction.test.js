import { describe, expect, it } from 'vitest'
import { weaponDamageActionExpression, selectedWeaponDamageExpression } from './weaponDamageAction'

describe('weapon feature damage action', () => {
  const action = { dice: 'd6', dice_count: 3, double_on_critical: true }

  it('adds current feature dice to regular weapon damage', () => {
    expect(weaponDamageActionExpression({
      baseExpression: '1d8{Колющий}+4{Колющий}',
      action,
      damageType: 'Колющий',
    })).toBe('1d8{Колющий}+4{Колющий}+3d6{Колющий}')
  })

  it('doubles feature dice together with critical weapon dice', () => {
    expect(weaponDamageActionExpression({
      baseExpression: '2d8{Колющий}+4{Колющий}',
      action,
      critical: true,
      damageType: 'Колющий',
    })).toBe('2d8{Колющий}+4{Колющий}+6d6{Колющий}')
  })
})

describe('combined damage choices', () => {
  const actions = [
    { key: 'sneak', dice: 'd6', dice_count: 3 },
    { key: 'extra', dice: 'd4', dice_count: 1, double_on_critical: false },
  ]
  it('combines independent choices once and never doubles flat damage', () => {
    expect(selectedWeaponDamageExpression({ baseExpression: '2d10+5', critical: true, actions, actionKeys: ['sneak', 'extra', 'sneak'] }))
      .toBe('2d10+5+6d6+1d4')
  })
  it('ignores stale selections that are no longer eligible for this weapon', () => {
    expect(selectedWeaponDamageExpression({ baseExpression: '1d8+5', actions: [], actionKeys: ['sneak'] })).toBe('1d8+5')
    expect(selectedWeaponDamageExpression({ baseExpression: '1d8+5', actions, actionKeys: [] })).toBe('1d8+5')
  })
})
