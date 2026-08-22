import { describe, expect, it } from 'vitest'
import { weaponDamageActionExpression } from './weaponDamageAction'

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
