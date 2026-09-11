import { beforeEach, describe, expect, it, vi } from 'vitest'
import { itemsApi } from '@/shared/api/itemsApi'
import { useManualClassEditor } from './useManualClassEditor'

vi.mock('@/shared/api/itemsApi', () => ({ itemsApi: { listAll: vi.fn() } }))

const fighter = { id: 1, name: 'Воин' }
const wizard = { id: 2, name: 'Волшебник' }
const champion = { id: 11, name: 'Чемпион', data: { class: { id: 1 } } }
const evoker = { id: 12, name: 'Школа воплощения', data: { class: { id: 2 } } }
const character = () => ({
  classes: [{ ...fighter, level: 1, subclass: { id: 11, name: 'Чемпион' } }],
  lvl: { level: 4, exp: 3200 },
  hp: { current: 25 },
  abilities_class: [{ id: 300 }],
})

beforeEach(() => {
  vi.resetAllMocks()
  itemsApi.listAll.mockImplementation(async type => ({ items: type === 9 ? [fighter, wizard] : [champion, evoker] }))
})

describe('manual character class editing', () => {
  it('isolates edits until saved and reopens the original data after cancellation', async () => {
    const values = character()
    const original = structuredClone(values)
    const editor = useManualClassEditor(() => values)
    await editor.load()
    expect(editor.rows.value[0].level).toBe(4)
    editor.rows.value[0].level = 7
    editor.changeSubclass(editor.rows.value[0], '')
    editor.add()
    editor.changeClass(editor.rows.value[1], 2)
    expect(values).toEqual(original)
    const reopened = useManualClassEditor(() => values)
    expect(reopened.rows.value).toHaveLength(1)
    expect(reopened.rows.value[0]).toMatchObject({ level: 4, subclass: { id: 11 } })
  })

  it('saves both single-class levels and the total without altering XP or granting features', async () => {
    const values = character()
    const editor = useManualClassEditor(() => values)
    await editor.load()
    editor.rows.value[0].level = 6
    values.lvl.exp = 5000
    const updates = editor.updates()
    expect(updates).toEqual({
      classes: [{ ...fighter, level: 6, subclass: { id: 11, name: 'Чемпион' } }],
      lvl: { level: 6, exp: 5000 },
    })
    expect(values.classes[0].level).toBe(1)
    updates.classes[0].subclass.name = 'Changed result'
    expect(editor.rows.value[0].subclass.name).toBe('Чемпион')
  })

  it('sums added classes and resynchronizes the total when only one remains', async () => {
    const editor = useManualClassEditor(() => character())
    await editor.load()
    editor.add()
    editor.changeClass(editor.rows.value[1], 2)
    editor.rows.value[1].level = 3
    expect(editor.updates().lvl.level).toBe(7)
    editor.remove(editor.rows.value[0])
    expect(editor.updates()).toMatchObject({ classes: [{ id: 2, level: 3 }], lvl: { level: 3 } })
    editor.remove(editor.rows.value[0])
    expect(editor.updates()).toBeNull()
    editor.add()
    editor.changeClass(editor.rows.value[0], 1)
    expect(editor.updates().lvl.level).toBe(1)
  })

  it('clears the previous subclass on replacement and offers only subclasses of the new class', async () => {
    const editor = useManualClassEditor(() => character())
    await editor.load()
    const row = editor.rows.value[0]
    editor.changeClass(row, 2)
    expect(row.subclass).toBeNull()
    expect(editor.subclassOptions(row).map(option => option.value)).toEqual(['', 12])
    editor.changeSubclass(row, 11)
    expect(row.subclass).toBeNull()
    editor.changeSubclass(row, 12)
    expect(editor.updates().classes[0]).toMatchObject({ id: 2, subclass: { id: 12 } })
    editor.changeSubclass(row, '')
    expect(editor.updates().classes[0].subclass).toBeNull()
  })

  it('blocks empty rows, duplicate classes, invalid levels and totals above twenty', async () => {
    const editor = useManualClassEditor(() => character())
    await editor.load()
    editor.add()
    const row = editor.rows.value[1]
    expect(editor.updates()).toBeNull()
    expect(editor.classOptions(row).find(option => option.value === 1).disabled).toBe(true)
    editor.changeClass(row, 1)
    expect(editor.updates()).toBeNull()
    editor.changeClass(row, 2)
    for (const level of [0, -1, 1.5, NaN, 21, 17]) {
      row.level = level
      expect(editor.updates()).toBeNull()
    }
    row.level = 16
    expect(editor.updates().lvl.level).toBe(20)
  })

  it('preserves saved references absent from the selected source catalogue', async () => {
    itemsApi.listAll.mockResolvedValue({ items: [] })
    const editor = useManualClassEditor(() => character())
    await editor.load()
    expect(editor.classOptions(editor.rows.value[0])).toEqual([{ value: 1, label: 'Воин', disabled: false }])
    expect(editor.subclassOptions(editor.rows.value[0])).toContainEqual({ value: 11, label: 'Чемпион' })
    expect(editor.updates().classes[0]).toMatchObject({ id: 1, subclass: { id: 11 } })
  })

  it('disables save on loading failures, keeps the draft and supports retry with the same source scope', async () => {
    const scope = { contentSources: { mode: 'selected' }, sourceVersionId: 7 }
    const editor = useManualClassEditor(() => character(), scope)
    expect(editor.updates()).toBeNull()
    editor.rows.value[0].level = 5
    itemsApi.listAll.mockRejectedValueOnce(new Error('Network error'))
    await editor.load()
    expect(editor.loadError.value).toBeTruthy()
    expect(editor.updates()).toBeNull()
    await editor.load()
    expect(editor.loadError.value).toBe('')
    expect(editor.updates().lvl.level).toBe(5)
    expect(itemsApi.listAll).toHaveBeenCalledWith(9, scope)
    expect(itemsApi.listAll).toHaveBeenCalledWith(17, scope)
  })
})
