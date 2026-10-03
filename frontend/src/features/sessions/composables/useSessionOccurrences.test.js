import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionOccurrences } from './useSessionOccurrences'
import * as api from '@/shared/api/sessionOccurrencesApi'
const hooks = vi.hoisted(() => ({ mounted: null, unmount: null }))
vi.mock('vue', async original => ({ ...await original(), onMounted: fn => { hooks.mounted = fn }, onBeforeUnmount: fn => { hooks.unmount = fn } }))
vi.mock('@/shared/api/sessionOccurrencesApi', () => ({ getSessionOccurrences: vi.fn(), createSessionOccurrence: vi.fn(), updateSessionOccurrence: vi.fn(), deleteSessionOccurrence: vi.fn() }))
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' })) })
afterEach(() => { hooks.unmount?.(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetAllMocks() })
describe('meeting editor lifecycle', () => {
  it('preserves a failed draft and stops polling until it is saved', async () => {
    const existing = { id: 9, number: 2, name: 'До правки', date: '2026-10-03', changedAt: 'revision' }
    api.getSessionOccurrences.mockResolvedValue({ occurrences: [existing] })
    api.updateSessionOccurrence.mockRejectedValueOnce(new Error('Номер уже занят'))
    const state = useSessionOccurrences('campaign')
    hooks.mounted(); await flush()
    state.edit(existing)
    state.draft.value.name = 'После правки'
    state.draft.value.number = 3
    await state.save(state.draft.value)
    expect(state.error.value).toBe('Номер уже занят')
    expect(state.draft.value.name).toBe('После правки')
    expect(state.occurrences.value[0].name).toBe('До правки')
    await vi.advanceTimersByTimeAsync(24000)
    expect(api.getSessionOccurrences).toHaveBeenCalledTimes(1)
    api.updateSessionOccurrence.mockResolvedValue({ occurrences: [{ ...existing, name: 'После правки', number: 3 }] })
    await state.save(state.draft.value)
    expect(state.draft.value).toBeNull()
    expect(state.error.value).toBe('')
    expect(api.updateSessionOccurrence).toHaveBeenLastCalledWith('campaign', 9, { number: 3, name: 'После правки', date: '2026-10-03', expectedChangedAt: 'revision' })
  })
  it('discards a late refresh started before opening the editor', async () => {
    const state = useSessionOccurrences('campaign')
    api.getSessionOccurrences.mockResolvedValueOnce({ occurrences: [{ id: 1, number: 1 }] })
    await state.load()
    let resolve
    api.getSessionOccurrences.mockReturnValueOnce(new Promise(done => { resolve = done }))
    const pending = state.load(true)
    state.edit()
    resolve({ occurrences: [{ id: 99, number: 99 }] }); await pending
    expect(state.occurrences.value[0].id).toBe(1)
    expect(state.draft.value.number).toBe(2)
  })
})
