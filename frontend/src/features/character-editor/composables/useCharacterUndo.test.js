import { describe, expect, it } from 'vitest'
import { createCharacterUndoHistory } from './useCharacterUndo'

describe('character undo history', () => {
  it('restores independent snapshots in reverse order', () => {
    const history = createCharacterUndoHistory()
    const data = { values: { name: 'Ада' }, var: {} }
    history.record(data)
    data.values.name = 'Беа'
    history.record(data)
    data.values.name = 'Вея'

    expect(history.undo().values.name).toBe('Беа')
    expect(history.undo().values.name).toBe('Ада')
    expect(history.undo()).toBeNull()
  })

  it('keeps only the configured number of entries', () => {
    const history = createCharacterUndoHistory(2)
    history.record({ value: 1 })
    history.record({ value: 2 })
    history.record({ value: 3 })

    expect(history.size).toBe(2)
    expect(history.undo().value).toBe(3)
    expect(history.undo().value).toBe(2)
  })
})
