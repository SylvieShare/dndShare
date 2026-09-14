import { effectScope, reactive } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { usePersistedDraft } from './usePersistedDraft'
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('localStorage', { setItem: vi.fn(), removeItem: vi.fn() }) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
it('does not recreate a cleared draft from queued writes or unmount', () => {
  const scope = effectScope(), state = reactive({ name: 'before' })
  let draft
  scope.run(() => { draft = usePersistedDraft(state, { key: 'draft' }) })
  state.name = 'edited'; draft.clear(); vi.runAllTimers(); scope.stop()
  expect(localStorage.removeItem).toHaveBeenCalledWith('draft')
  expect(localStorage.setItem).not.toHaveBeenCalled()
})
it('flushes the latest draft on scope disposal and resumes after reset', () => {
  const scope = effectScope(), state = reactive({ name: 'before' })
  let draft
  scope.run(() => { draft = usePersistedDraft(state, { key: 'draft' }) })
  state.name = ''; draft.clear(); state.name = 'new draft'; scope.stop()
  expect(localStorage.setItem).toHaveBeenCalledTimes(1)
  expect(localStorage.setItem).toHaveBeenCalledWith('draft', '{"name":"new draft"}')
})
it('does not persist intermediate hydration', () => {
  const scope = effectScope(), state = reactive({ name: '' }); let hydrating = true
  scope.run(() => usePersistedDraft(state, { key: 'draft', paused: () => hydrating }))
  state.name = 'restored'; vi.runAllTimers(); expect(localStorage.setItem).not.toHaveBeenCalled()
  hydrating = false; state.name = 'edited'; vi.advanceTimersByTime(300)
  expect(localStorage.setItem).toHaveBeenCalledTimes(1); scope.stop()
})
