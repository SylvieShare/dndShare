import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { characterSnapshotStorageKey, createCharacterSnapshotRecorder } from './characterSnapshots'
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return { getItem: vi.fn(key => values.get(key) ?? null), setItem: vi.fn((key, value) => values.set(key, value)) }
}
beforeEach(() => vi.useFakeTimers())
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
describe('character browser snapshots', () => {
  it('coalesces typing and preserves the final value at dispose', () => {
    const storage = memoryStorage(), data = reactive({ values: { name: '' } })
    const recorder = createCharacterSnapshotRecorder('one', () => data, { storage })
    for (const name of ['А', 'Ад', 'Ада']) { data.values.name = name; recorder.schedule(); vi.advanceTimersByTime(20) }
    expect(storage.setItem).not.toHaveBeenCalled()
    recorder.dispose()
    expect(storage.setItem).toHaveBeenCalledTimes(1)
    expect(JSON.parse(storage.getItem(characterSnapshotStorageKey('one'))).at(-1).values.name).toBe('Ада')
    vi.runAllTimers()
    expect(storage.setItem).toHaveBeenCalledTimes(1)
  })
  it('keeps three independent states and reads the previous history only once', () => {
    const storage = memoryStorage(), data = reactive({ values: { name: '' } })
    const recorder = createCharacterSnapshotRecorder('one', () => data, { storage })
    for (const name of ['Ада', 'Беа', 'Вея', 'Гея']) { data.values.name = name; recorder.schedule(); vi.advanceTimersByTime(300) }
    expect(storage.getItem).toHaveBeenCalledTimes(1)
    expect(JSON.parse(storage.getItem(characterSnapshotStorageKey('one'))).map(s => s.values.name)).toEqual(['Беа', 'Вея', 'Гея'])
    recorder.dispose()
  })
  it('bounds persistence delay during continuous editing', () => {
    const storage = memoryStorage()
    const recorder = createCharacterSnapshotRecorder('one', () => ({ values: {} }), { storage })
    for (let i = 0; i < 10; i++) { recorder.schedule(); vi.advanceTimersByTime(100) }
    expect(storage.setItem).toHaveBeenCalledTimes(1)
    recorder.dispose()
  })
  it('recovers malformed storage and skips unchanged states', () => {
    const key = characterSnapshotStorageKey('one'), storage = memoryStorage({ [key]: 'invalid' })
    const recorder = createCharacterSnapshotRecorder('one', () => ({ values: {} }), { storage })
    recorder.schedule(); recorder.flush(); recorder.schedule(); recorder.flush(); recorder.dispose()
    expect(JSON.parse(storage.getItem(key))).toEqual([{ values: {} }])
    expect(storage.setItem).toHaveBeenCalledTimes(1)
  })
  it('never throws for inaccessible storage and does not save a read-only state', () => {
    const storage = { getItem: () => { throw Error('denied') }, setItem: () => { throw Error('denied') } }
    const recorder = createCharacterSnapshotRecorder('one', () => ({ values: {} }), { storage })
    recorder.schedule(); expect(() => recorder.dispose()).not.toThrow()
    const untouched = memoryStorage(), readOnly = createCharacterSnapshotRecorder('other', () => null, { storage: untouched })
    readOnly.schedule(); readOnly.dispose(); expect(untouched.setItem).not.toHaveBeenCalled()
  })
  it('flushes on pagehide and removes its lifecycle listener', () => {
    const target = new EventTarget(); vi.stubGlobal('window', target)
    const storage = memoryStorage(), recorder = createCharacterSnapshotRecorder('one', () => ({ values: {} }), { storage })
    recorder.schedule(); target.dispatchEvent(new Event('pagehide'))
    expect(storage.setItem).toHaveBeenCalledTimes(1)
    recorder.dispose(); target.dispatchEvent(new Event('pagehide'))
    expect(storage.setItem).toHaveBeenCalledTimes(1)
  })
})
