import { describe, expect, it } from 'vitest'
import { timeLabel, rangeLabel, timeError } from './spellPresentation'
import { catalogueFieldVisible, updateCatalogueValue } from '@/features/items/editor/catalogue/catalogueFields'
import { catalogueValidation } from '@/features/items/editor/catalogue/catalogueValidation'

describe('structured spell presentation', () => {
  it('formats actions, timed activities, custom alternatives and reaction triggers', () => {
    expect(timeLabel({ kind: 'bonus_action' })).toBe('Бонусное действие')
    expect(timeLabel({ kind: 'reaction', condition: 'Когда попадает атака' })).toBe('Реакция · Когда попадает атака')
    expect(timeLabel({ kind: 'reaction', condition: 'Когда попадает атака' }, false)).toBe('Реакция')
    expect(timeLabel({ kind: 'minutes', value: 10 })).toBe('10 мин.')
    expect(timeLabel({ kind: 'custom', text: '8 часов или действие' })).toBe('8 часов или действие')
  })
  it('distinguishes origin, distance, area and self targeting', () => {
    expect(rangeLabel({ kind: 'self' })).toBe('На себя')
    expect(rangeLabel({ kind: 'self', shape: 'cone', size: 15 })).toBe('От себя · Конус 15 фт.')
    expect(rangeLabel({ kind: 'ranged', distance: 60, shape: 'sphere', size: 20 })).toBe('60 фт. · Сфера 20 фт.')
    expect(rangeLabel({ kind: 'ranged', distance: 1, unit: 'miles', can_self: true })).toBe('1 миля')
    expect(rangeLabel({ kind: 'custom', text: 'Особая дистанция' })).toBe('Особая дистанция')
  })
  it('hides irrelevant range controls and clears their values on switching', () => {
    const visible = (data, path) => catalogueFieldVisible({}, data, 5, path)
    expect(visible({ kind: 'touch' }, 'range.distance')).toBe(false)
    expect(visible({ kind: 'ranged' }, 'range.distance')).toBe(true)
    expect(visible({ kind: 'ranged' }, 'range.size')).toBe(false)
    expect(visible({ kind: 'self', shape: 'sphere' }, 'range.size')).toBe(true)
    expect(updateCatalogueValue({ kind: 'ranged', distance: 60, unit: 'feet', can_self: true }, { key: 'kind' }, 'touch', 'range.kind', 5)).toEqual({ kind: 'touch', can_self: true })
  })
  it('rejects incomplete custom or numerical definitions', () => {
    expect(timeError({ kind: 'minutes', value: -1 })).not.toBe('')
    expect(timeError({ kind: 'custom' })).not.toBe('')
    expect(catalogueValidation([], { range: { kind: 'ranged' } }, 5)).toContain('Укажите дальность больше нуля.')
  })
})
