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
it('blocks open forms while allowing the navigation drawer during an explicit restart', () => {
  expect(updateSafePoint({ ...document, querySelectorAll: () => [{ querySelector: () => null }] }, '/', 0, true)).toBe(false)
  expect(updateSafePoint({ ...document, querySelectorAll: () => [{ querySelector: selector => selector === '.desktop-sidebar' ? {} : null }] }, '/', 0, true)).toBe(true)
})

it('allows explicit restart from the idle sessions list and protects an unfinished join', () => {
  const unfinishedJoin = { ...document, querySelector: selector => selector === '[data-session-join-unfinished]' ? {} : null }
  const openForm = { ...document, querySelectorAll: () => [{ querySelector: () => null }] }
  for (const path of ['/sessions', '/sessions/']) {
    expect(updateSafePoint(document, path, 0, true)).toBe(true)
    expect(updateSafePoint(document, path)).toBe(false)
    expect(updateSafePoint(document, path, 1, true)).toBe(false)
    expect(updateSafePoint(unfinishedJoin, path, 0, true)).toBe(false)
    expect(updateSafePoint(openForm, path, 0, true)).toBe(false)
  }
  expect(updateSafePoint(document, '/sessions/active-session', 0, true)).toBe(false)
})
