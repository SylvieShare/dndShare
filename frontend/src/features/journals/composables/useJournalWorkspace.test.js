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
  setJournalPlayerEditing: vi.fn(), reorderJournalEntries: vi.fn(),
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
  it('applies player read-only access on refresh and persists DM settings', async () => {
    vi.mocked(api.getSessionJournal).mockResolvedValueOnce({ ...response('session'), canManage: true })
    const workspace = useJournalWorkspace({ sessionUuid: 'campaign' })
    hooks.mounted()
    await flush()
    expect(workspace.canManage.value).toBe(true)
    vi.mocked(api.setJournalPlayerEditing).mockResolvedValueOnce({ ...response('session'), journal: { ...response('session').journal, playersCanEdit: false } })
    await workspace.setPlayerEditing(false)
    expect(api.setJournalPlayerEditing).toHaveBeenCalledWith('session', false)
    expect(workspace.journal.value.playersCanEdit).toBe(false)
    vi.mocked(api.getSessionJournal).mockResolvedValueOnce({ ...response('session'), canEdit: false, canManage: false })
    await vi.advanceTimersByTimeAsync(12_000)
    expect(workspace.canEdit.value).toBe(false)
    expect(workspace.canManage.value).toBe(false)
  })

  it('protects dragging from polls and sends the canonical order', async () => {
    vi.mocked(api.getCharacterJournal).mockResolvedValueOnce(response())
    const workspace = useJournalWorkspace({ characterUuid: 'character' })
    hooks.mounted()
    await flush()
    let resolvePoll
    vi.mocked(api.getCharacterJournal).mockReturnValueOnce(new Promise(resolve => { resolvePoll = resolve }))
    vi.advanceTimersByTime(12_000)
    workspace.setDragging(true)
    resolvePoll(response('stale'))
    await flush()
    await vi.advanceTimersByTimeAsync(12_000)
    expect(api.getCharacterJournal).toHaveBeenCalledTimes(2)
    expect(workspace.journal.value.uuid).toBe('personal')
    workspace.setDragging(false)
    vi.mocked(api.reorderJournalEntries).mockResolvedValueOnce(response())
    await workspace.reorderEntries('section', ['3', '1', '2'])
    expect(api.reorderJournalEntries).toHaveBeenCalledWith('personal', 'section', ['3', '1', '2'])
  })

  it('keeps existing content and reports a rejected reorder', async () => {
    vi.mocked(api.getCharacterJournal).mockResolvedValueOnce(response())
    const workspace = useJournalWorkspace({ characterUuid: 'character' })
    hooks.mounted()
    await flush()
    vi.mocked(api.reorderJournalEntries).mockRejectedValueOnce(new Error('Обновите дневник'))
    await expect(workspace.reorderEntries('section', ['1'])).rejects.toThrow('Обновите дневник')
    expect(workspace.journal.value.uuid).toBe('personal')
    expect(workspace.error.value).toBe('Обновите дневник')
    expect(workspace.busy.value).toBe(false)
  })

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
