import { createRenderer, h, nextTick } from 'vue'
import * as Vue from 'vue'
import { beforeEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import { compile } from '@vue/compiler-dom'
import Modal from './MagicEquipmentInstanceModal.vue'
import { itemsApi } from '@/shared/api/itemsApi'

const { descriptor } = parse(readFileSync(new URL('./MagicEquipmentInstanceModal.vue', import.meta.url), 'utf8'))
const script = compileScript(descriptor, { id: 'base-choice' })
Modal.render = new Function('Vue', compile(descriptor.template.content, { mode: 'function', prefixIdentifiers: true, bindingMetadata: script.bindings }).code)(Vue)
vi.mock('@/shared/api/itemsApi', () => ({ itemsApi: { byIds: vi.fn(), listAll: vi.fn() } }))
vi.mock('@sylvieshare/share-ui', () => ({
  AppModalFrame: { setup: (_, { slots }) => () => h('dialog', [slots.default?.(), slots.footer?.()]) },
  ActionButton: { setup: (_, { slots }) => () => h('button', slots.default?.()) },
  LoadingState: { setup: () => () => h('span', 'loading') },
}))
vi.mock('@/shared/ui/DetailSection.vue', () => ({ default: { setup: (_, { slots }) => () => h('section', slots.default?.()) } }))
vi.mock('./MagicEquipmentBases.vue', () => ({ default: {
  props: ['kind', 'baseItems'], setup: (props, { emit }) => () => h('div', { 'data-kind': props.kind }, props.baseItems.map(base =>
    h('button', { 'data-base': base.id, onClick: () => emit('update:modelValue', base.id) }, base.name))),
} }))
const sword = { id: 49, name: 'Меч', typeId: 1 }, bow = { id: 54, name: 'Лук', typeId: 1 }
const armor = { id: 12, name: 'Латы', typeId: 12, data: { armor: { base: 18 } } }
const flush = async () => { for (let i = 0; i < 8; i++) { await Promise.resolve(); await nextTick() } }
beforeEach(() => { vi.clearAllMocks(); itemsApi.byIds.mockResolvedValue({ items: [sword] }); itemsApi.listAll.mockResolvedValue({ items: [sword, bow] }) })
function mount(data) {
  const node = type => ({ type, props: {}, children: [], parent: null })
  const renderer = createRenderer({
    setScopeId() {}, createElement: node, createText: node, createComment: node,
    setText() {}, setElementText: (el, text) => { el.text = text }, patchProp: (el, key, _, value) => { el.props[key] = value },
    parentNode: el => el.parent, nextSibling: () => null,
    insert(el, parent) { el.parent = parent; parent.children.push(el) },
    remove(el) { if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1) },
  })
  const root = node('root'), confirm = vi.fn()
  const app = renderer.createApp({ render: () => h(Modal, { item: { id: 99, name: 'Предмет', typeId: 19, data }, onConfirm: confirm }) })
  app.provide(Vue.ssrContextKey, { modules: new Set() }); app.mount(root)
  const all = (type, el = root) => [...(el.type === type ? [el] : []), ...el.children.flatMap(child => all(type, child))]
  return { confirm, all, unmount: () => app.unmount() }
}
it.each([{ base_item_id: 49 }, { allowed_base_item_ids: [49] }])('adds the only valid weapon base without asking for confirmation: %o', async rule => {
  const form = mount({ weapon: rule }); await flush()
  expect(form.confirm).toHaveBeenCalledExactlyOnceWith({ weapon_base_item_id: 49 })
  expect(form.all('dialog')).toEqual([]); form.unmount()
})
it('also selects a fixed armor base automatically', async () => {
  itemsApi.byIds.mockResolvedValue({ items: [armor] })
  const form = mount({ armor_base: { base_item_id: 12 } }); await flush()
  expect(form.confirm).toHaveBeenCalledExactlyOnceWith({ armor_base_item_id: 12 }); form.unmount()
})
it('asks only for the ambiguous base in an item with both kinds', async () => {
  itemsApi.byIds.mockImplementation(async ids => ({ items: ids.includes(12) ? [armor] : [sword, bow] }))
  const form = mount({ weapon: { allowed_base_item_ids: [49, 54] }, armor_base: { base_item_id: 12 } }); await flush()
  expect(form.confirm).not.toHaveBeenCalled()
  expect(form.all('div').map(el => el.props['data-kind'])).toEqual(['weapon'])
  form.all('button').find(el => el.props['data-base'] === 54).props.onClick(); await flush()
  form.all('button').find(el => el.props['data-base'] == null).props.onClick()
  expect(form.confirm).toHaveBeenCalledWith({ weapon_base_item_id: 54, armor_base_item_id: 12 }); form.unmount()
})
it('counts eligible results, not stale references, and does not create missing bases', async () => {
  itemsApi.byIds.mockResolvedValue({ items: [] })
  const missing = mount({ weapon: { base_item_id: 49 } }); await flush()
  expect(missing.confirm).not.toHaveBeenCalled(); expect(missing.all('dialog')).toHaveLength(1); missing.unmount()
  itemsApi.byIds.mockResolvedValue({ items: [sword, armor] })
  const sole = mount({ weapon: { allowed_base_item_ids: [49, 12] } }); await flush()
  expect(sole.confirm).toHaveBeenCalledWith({ weapon_base_item_id: 49 }); sole.unmount()
})
it('does not add an item after its picker was closed during loading', async () => {
  let resolve
  itemsApi.byIds.mockImplementation(() => new Promise(done => { resolve = done }))
  const form = mount({ weapon: { base_item_id: 49 } }); form.unmount()
  resolve({ items: [sword] }); await flush(); expect(form.confirm).not.toHaveBeenCalled()
})
it('offers retry on loading failure instead of silently creating an unconfigured item', async () => {
  itemsApi.byIds.mockRejectedValueOnce(new Error('offline'))
  const form = mount({ weapon: { base_item_id: 49 } }); await flush()
  expect(form.confirm).not.toHaveBeenCalled(); expect(form.all('dialog')).toHaveLength(1)
  form.all('button')[0].props.onClick(); await flush()
  expect(form.confirm).toHaveBeenCalledWith({ weapon_base_item_id: 49 }); form.unmount()
})
