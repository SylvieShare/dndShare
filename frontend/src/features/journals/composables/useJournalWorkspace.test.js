import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useJournalWorkspace } from './useJournalWorkspace'
import * as api from '@/shared/api/journalsApi'

const hooks = vi.hoisted(() => ({ mounted: null, unmount: null }))
vi.mock('vue', async importOriginal => ({
  ...await importOriginal(),
  onMounted: callback => { hooks.mounted = callback },
  onBeforeUnmount: callback => { hooks.unmount = callback },
}))
vi.mock('@/shared/api/journalsApi', () => ({
  getCharacterJournal: vi.fn(), getSessionJournal: vi.fn(),
  createCharacterJournal: vi.fn(), createSessionJournal: vi.fn(), setCharacterJournal: vi.fn(),
  createJournalSection: vi.fn(), updateJournalSection: vi.fn(), deleteJournalSection: vi.fn(),
  createJournalEntry: vi.fn(), updateJournalEntry: vi.fn(), deleteJournalEntry: vi.fn(),
}))
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }
const response = (uuid = 'personal', sources = []) => ({
  journal: { uuid, name: uuid, kind: uuid, sections: [] }, sources, canEdit: true, canSelectSource: true,
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('window', { setInterval, clearInterval })
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }))
})
afterEach(() => {
  hooks.unmount?.()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

describe('journal source lifecycle', () => {
  it('discovers a newly created session source on background refresh', async () => {
    vi.mocked(api.getCharacterJournal).mockResolvedValueOnce(response())
    const workspace = useJournalWorkspace({ characterUuid: 'character' })
    hooks.mounted()
    await flush()
    vi.mocked(api.getCharacterJournal).mockResolvedValueOnce(response('personal', [{ uuid: 'session', kind: 'session' }]))
    await vi.advanceTimersByTimeAsync(12_000)
    expect(workspace.sources.value).toEqual([{ uuid: 'session', kind: 'session' }])
    vi.mocked(api.getCharacterJournal).mockResolvedValueOnce({ ...response(), sources: undefined })
    await vi.advanceTimersByTimeAsync(12_000)
    expect(workspace.sources.value).toEqual([])
  })

  it('does not let a stale poll undo a newer source selection', async () => {
    vi.mocked(api.getCharacterJournal).mockResolvedValueOnce(response())
    const workspace = useJournalWorkspace({ characterUuid: 'character' })
    hooks.mounted()
    await flush()
    let resolvePoll
    vi.mocked(api.getCharacterJournal).mockReturnValueOnce(new Promise(resolve => { resolvePoll = resolve }))
    vi.advanceTimersByTime(12_000)
    vi.mocked(api.setCharacterJournal).mockResolvedValueOnce(response('session'))
    await workspace.selectSource('session')
    resolvePoll(response('personal'))
    await flush()
    expect(workspace.journal.value.uuid).toBe('session')
    expect(api.setCharacterJournal).toHaveBeenCalledWith('character', 'session')
  })
})
