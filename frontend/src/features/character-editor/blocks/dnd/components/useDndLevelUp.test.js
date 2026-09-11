import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRenderer, nextTick } from 'vue'
import { useDndLevelUp } from './useDndLevelUp'

const bard = { id: 4016, name: 'Бард', nameEn: 'Bard', data: {
  hit_die: 'd8', caster_progression: 'full', subclass_level: 3,
  spellcasting: { ability: 6, known_progression: [{ level: 2, cantrips: 2, spells: 5 }] },
} }
vi.mock('@/shared/api/itemsApi', () => ({ itemsApi: { byIds: vi.fn(async () => ({ items: [bard] })) } }))
vi.mock('@/shared/api/http', () => ({ fetchGet: vi.fn(async url => ({ items: url.includes('typeId=9') ? [bard] : [] })) }))
vi.mock('@/stores/suggest', () => ({ useSuggestStore: () => ({ ensure() {}, items: () => [] }) }))
vi.mock('@/stores/dice', () => ({ useDiceStore: () => ({ roll: () => ({ total: 3 }) }) }))
vi.mock('@/shared/lib/systemDice', () => ({ dieLabel: value => value }))
const cleanups = []
async function mount() {
  let state
  const emit = vi.fn()
  const values = { lvl: { level: 1, exp: 300 }, classes: [{ id: 4016, name: 'Бард', level: 1 }],
    CON: { value: 14 }, hp: { max: 10, current: 10 },
    spells: { tabs: [], grants: [], slot_pools: { long_rest: [{ level: 1, total: 2, used: 1 }], short_rest: [] } },
  }
  const renderer = createRenderer({ createComment: () => ({}), insert() {}, remove() {}, parentNode() {}, nextSibling() {} })
  const app = renderer.createApp({ setup() { state = useDndLevelUp({ values }, emit); return () => null } })
  app.provide('charCtx', {})
  app.mount({})
  cleanups.push(() => app.unmount())
  await nextTick(); await nextTick()
  await state.chooseClass(0)
  return { state, values, emit }
}
afterEach(() => cleanups.splice(0).forEach(cleanup => cleanup()))

describe('level-up application', () => {
  it('requires loaded spells and a completed HP roll, then applies automatic slots and HP together', async () => {
    const { state, emit, values } = await mount()
    expect(state.hp.hpGain).toBe(7)
    expect(state.canAccept.value).toBe(false)
    state.classSpellSelection.value = { ready: true, tab: state.levelUpSpellContext.value.tab, entries: [] }
    expect(state.canAccept.value).toBe(true)
    expect(state.slotChanges.value).toEqual([{ kind: 'added', level: 1, count: 1, pact: false }])
    state.hp.setHpMode('roll')
    expect(state.canAccept.value).toBe(false)
    state.hp.rollHp()
    expect(state.hp.hpGain).toBe(5)
    expect(state.canAccept.value).toBe(true)
    await state.accept()
    const updates = emit.mock.calls.find(call => call[0] === 'apply')[1]
    expect(updates.lvl.level).toBe(2)
    expect(updates.hp.max.base).toBe(15)
    expect(updates.spells.slot_pools.long_rest[0]).toMatchObject({ level: 1, total: 3, used: 1 })
    expect(values.hp.max).toBe(10)
  })
  it('treats manual HP as the final gain and resets draft choices on changing the target', async () => {
    const { state } = await mount()
    state.hp.setHpMode('manual')
    state.hp.hpManual = 9
    expect(state.hp.hpGain).toBe(9)
    await state.chooseClass(0)
    expect(state.hp.hpMode).toBe('avg')
    expect(state.hp.hpManual).toBe(null)
    expect(state.hp.hpGain).toBe(7)
  })
})
