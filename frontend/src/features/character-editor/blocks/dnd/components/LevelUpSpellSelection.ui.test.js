import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRenderer, nextTick } from 'vue'
import { useLevelUpSpellSelection } from './useLevelUpSpellSelection'
import { itemsApi } from '@/shared/api/itemsApi'

vi.mock('@/shared/api/itemsApi', () => ({ itemsApi: { byIds: vi.fn() } }))
const item = (id, level = 1) => ({ id, name: `Заклинание ${id}`, data: { lvl: level, classes: [{ id: 4016 }] } })
const spells = [item(1, 0), item(2, 0), item(3), item(4), item(5), item(6)]
const context = {
  tab: { key: 'bard', class_item_id: 4016, name: 'Бард', spells: [] }, maxSpellLevel: 1,
  rules: { selectionMode: 'known', listClassId: 4016, hasKnownProgression: true, cantripsKnown: 2, spellsKnown: 5 },
}
const cleanups = []
async function mount(overrides = {}) {
  let state
  const emit = vi.fn()
  const renderer = createRenderer({
    createComment: () => ({}), insert() {}, remove() {}, parentNode() {}, nextSibling() {},
  })
  const app = renderer.createApp({ setup() {
    state = useLevelUpSpellSelection({ context, existingSpells: spells.map(({ id }) => ({ id, key: `s${id}` })), ...overrides }, emit)
    return () => null
  } })
  app.mount({})
  cleanups.push(() => app.unmount())
  await nextTick()
  await nextTick()
  return { state, emit, payload: () => emit.mock.calls.at(-1)[1] }
}
beforeEach(() => itemsApi.byIds.mockResolvedValue({ items: spells }))
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.clearAllMocks() })

describe('level-up spell draft', () => {
  it('shows one new bard spell, and keeps the existing list when the replacement picker is cancelled', async () => {
    const { state, payload } = await mount()
    expect(state.budget.value).toMatchObject({ cantrips: 0, spells: 1, replacements: 1 })
    expect(payload().ready).toBe(true)
    state.openReplacement(state.rows.value[2])
    expect(state.pickerTitle.value).toBe('Заменить «Заклинание 3»')
    expect(state.pickerFilters.value).toEqual({ 'classes.id': [4016], lvl: [1] })
    state.picker.value = null
    await nextTick()
    expect(payload().entries.map(entry => entry.id)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('uses independent budgets for additions and replacement, and supports changing or undoing the replacement', async () => {
    const { state, payload } = await mount()
    state.picker.value = { kind: 'spell' }
    state.add(item(7))
    expect(state.budget.value.spellsRemaining).toBe(0)
    state.openReplacement(state.rows.value[2])
    state.add(item(8))
    await nextTick()
    expect(payload().entries.map(entry => entry.id)).toEqual([1, 2, 8, 4, 5, 6, 7])
    expect(state.canReplace(state.rows.value[3])).toBe(false)
    expect(state.canReplace(state.rows.value[0])).toBe(false)
    state.openReplacement(state.rows.value[2])
    state.add(item(9))
    expect(state.replacementCount.value).toBe(1)
    state.undoReplacement(state.rows.value[2])
    state.removeAddition(state.additions.value[0])
    await nextTick()
    expect(payload().entries.map(entry => entry.id)).toEqual([1, 2, 3, 4, 5, 6])
    expect(state.budget.value.spellsRemaining).toBe(1)
    expect(state.replacementCount.value).toBe(0)
  })

  it('rejects wrong classes, unavailable circles, duplicate choices and additions over the limit', async () => {
    const { state } = await mount()
    state.picker.value = { kind: 'spell' }
    for (const candidate of [item(7, 2), { ...item(8), data: { lvl: 1, classes: [{ id: 9 }] } }, item(3), item(9, 0)]) {
      expect(state.pickerEligibility(candidate).eligible).toBe(false)
      state.add(candidate)
    }
    expect(state.additions.value).toHaveLength(0)
    state.add(item(10))
    state.picker.value = { kind: 'spell' }
    state.add(item(11))
    expect(state.additions.value.map(entry => entry.id)).toEqual([10])
  })

  it('preserves a wizard book and allows exactly the level-up additions', async () => {
    const { state } = await mount({ context: { ...context, rules: { ...context.rules, selectionMode: 'spellbook', levelUpChoices: 2 } } })
    expect(state.budget.value.spells).toBe(2)
    expect(state.canReplace(state.rows.value[2])).toBe(false)
    for (const id of [7, 8, 9]) { state.picker.value = { kind: 'spell' }; state.add(item(id)) }
    expect(state.additions.value).toHaveLength(2)
  })

  it('blocks acceptance when known spells cannot be loaded and recovers after retry', async () => {
    itemsApi.byIds.mockRejectedValueOnce(new Error('Network'))
    const { state, payload } = await mount()
    expect(state.error.value).toBeTruthy()
    expect(payload().ready).toBe(false)
    await state.load()
    await nextTick()
    expect(payload().ready).toBe(true)
    expect(payload().entries).toHaveLength(6)
  })
})
