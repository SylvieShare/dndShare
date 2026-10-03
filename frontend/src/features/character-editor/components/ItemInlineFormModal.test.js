import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRenderer, h, ssrContextKey } from 'vue'
import ItemInlineFormModal from './ItemInlineFormModal.vue'
import { entryDisplayData, inventoryEntriesWeight } from '../blocks/dnd/lib/itemSection'
import { useInventoryTooltip } from '@/features/inventory/composables/useInventoryTooltip'

const cleanups = []
function mount(entry = null) {
  const save = vi.fn()
  const vnode = h({ ...ItemInlineFormModal, render: () => null }, { entry, onSave: save })
  const renderer = createRenderer({
    createComment: () => ({}), insert() {}, remove() {}, parentNode() {}, nextSibling() {},
  })
  const app = renderer.createApp({ render: () => vnode })
  app.provide(ssrContextKey, { modules: new Set() })
  app.mount({})
  cleanups.push(() => app.unmount())
  return { state: vnode.component.setupState, save }
}
afterEach(() => cleanups.splice(0).forEach(cleanup => cleanup()))

describe('custom inventory item weight', () => {
  it('saves fractional weight per piece and uses the whole stack in the space total and tooltip', () => {
    const { state, save } = mount()
    state.name = 'Самодельная стрела'
    state.weight = '0.25'
    state.submit()
    expect(save.mock.calls[0][0]).toMatchObject({ name: 'Самодельная стрела', weight: 0.25 })
    const entry = { item_id: null, count: 3, override: save.mock.calls[0][0] }
    expect(inventoryEntriesWeight([entry], {})).toBe(0.75)
    const { tooltip, showTooltip } = useInventoryTooltip()
    showTooltip({ currentTarget: {} }, entryDisplayData(entry, {}))
    expect(tooltip.item.data.weight).toBe(0.75)
  })

  it('preserves weight when changing the name and allows clearing it or setting it to zero', () => {
    const { state, save } = mount({ item_id: null, override: { name: 'Верёвка', weight: 1.5 } })
    expect(state.weight).toBe(1.5)
    state.name = 'Короткая верёвка'
    state.submit()
    expect(save.mock.calls.at(-1)[0].weight).toBe(1.5)
    state.weight = ''
    state.submit()
    expect(save.mock.calls.at(-1)[0].weight).toBeNull()
    state.weight = '0'
    state.submit()
    expect(save.mock.calls.at(-1)[0].weight).toBe(0)
  })

  it.each(['-1', 'invalid', 'Infinity'])('blocks invalid weight %s even when submitted from the keyboard', weight => {
    const { state, save } = mount()
    state.name = 'Предмет'
    state.weight = weight
    expect(state.weightValid).toBe(false)
    state.submit()
    expect(save).not.toHaveBeenCalled()
  })
})
