import { expect, it } from 'vitest'
import { visibleHandbookType } from './abilityTypes'
it('hides child origin sections without hiding their parents or abilities', () => {
  expect([3, 8, 9, 16, 17, 18].filter(id => visibleHandbookType({ id, countItems: 10 }))).toEqual([3, 8, 9, 18])
  expect(visibleHandbookType({ id: '16', countItems: 100 })).toBe(false)
})
