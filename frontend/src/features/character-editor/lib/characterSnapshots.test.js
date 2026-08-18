import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { characterSnapshotStorageKey, recordCharacterSnapshot } from './characterSnapshots'

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

describe('character browser snapshots', () => {
  it('keeps the three latest reactive character states', () => {
    const storage = memoryStorage()
    const data = reactive({ values: { name: 'Ада' }, var: {} })

    for (const name of ['Ада', 'Беа', 'Вея', 'Гея']) {
      data.values.name = name
      expect(recordCharacterSnapshot('character-1', data, storage)).toBe(true)
    }

    const saved = JSON.parse(storage.getItem(characterSnapshotStorageKey('character-1')))
    expect(saved.map(snapshot => snapshot.values.name)).toEqual(['Беа', 'Вея', 'Гея'])
  })

  it('starts a fresh history when the previous value is malformed', () => {
    const key = characterSnapshotStorageKey('character-1')
    const storage = memoryStorage({ [key]: 'not json' })

    expect(recordCharacterSnapshot('character-1', { values: { name: 'Ада' } }, storage)).toBe(true)
    expect(JSON.parse(storage.getItem(key))).toEqual([{ values: { name: 'Ада' } }])
  })

  it('never blocks editing when browser storage is unavailable', () => {
    const storage = {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
    }

    expect(() => recordCharacterSnapshot('character-1', { values: {} }, storage)).not.toThrow()
    expect(recordCharacterSnapshot('character-1', { values: {} }, storage)).toBe(false)
  })
})
