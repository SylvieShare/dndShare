import { describe, expect, it } from 'vitest'
import {
  createHeaderChip,
  normalizeHeaderChip,
  resolveAppHeaderContext,
} from './appHeader'

describe('app header context resolution', () => {
  it('uses a route-owned handbook title and count chip', () => {
    expect(resolveAppHeaderContext({
      routeName: 'Handbook',
      routeTitle: 'Справочник',
      owner: 'Handbook',
      title: 'Бестиарий',
      chip: createHeaderChip(42),
    })).toEqual({
      title: 'Бестиарий',
      chip: { label: '42', color: '' },
    })
  })

  it('keeps the route fallback when prior page context has another owner', () => {
    expect(resolveAppHeaderContext({
      routeName: 'Sessions',
      routeTitle: 'Сессии',
      owner: 'Handbook',
      title: 'Бестиарий',
      chip: createHeaderChip(42),
    })).toEqual({ title: 'Сессии', chip: null })
  })

  it('keeps a colored header chip', () => {
    expect(normalizeHeaderChip(createHeaderChip('42', 'var(--success)'))).toEqual({
      label: '42',
      color: 'var(--success)',
    })
  })

  it('only honors legacy unscoped titles when explicitly allowed', () => {
    const context = {
      routeName: 'Characters',
      routeTitle: 'Персонажи',
      owner: null,
      title: 'Старый персонаж',
    }
    expect(resolveAppHeaderContext(context).title).toBe('Персонажи')
    expect(resolveAppHeaderContext({ ...context, allowUnscoped: true }).title).toBe('Старый персонаж')
  })
})
