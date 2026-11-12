import { expect, it } from 'vitest'
import { updateSafePoint } from './updateSafety'
const document = { activeElement: { matches: () => false }, querySelector: () => null, querySelectorAll: () => [] }
it('allows a warm update on idle pages and keeps character/editor/session work intact', () => {
  expect(updateSafePoint(document, '/chars')).toBe(true)
  expect(updateSafePoint(document, '/char/abc')).toBe(false)
  expect(updateSafePoint(document, '/char/abc', 0, true)).toBe(true)
  for (const route of ['/maps/editor', '/sessions/abc', '/map-screen/abc', '/chars/new', '/admin']) expect(updateSafePoint(document, route, 0, true)).toBe(false)
  expect(updateSafePoint(document, '/', 1)).toBe(false)
  expect(updateSafePoint({ ...document, activeElement: { matches: () => true } }, '/')).toBe(false)
})
it('blocks open forms while allowing the version panel itself during an explicit restart', () => {
  expect(updateSafePoint({ ...document, querySelectorAll: () => [{ querySelector: () => null }] }, '/', 0, true)).toBe(false)
  expect(updateSafePoint({ ...document, querySelectorAll: () => [{ querySelector: () => ({}) }] }, '/', 0, true)).toBe(true)
  expect(updateSafePoint({ ...document, querySelectorAll: () => [{ querySelector: selector => selector === '.desktop-sidebar' ? {} : null }] }, '/', 0, true)).toBe(true)
})
