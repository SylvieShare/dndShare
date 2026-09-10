import { createRenderer, h, nextTick } from 'vue'
import * as Vue from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import { compile } from '@vue/compiler-dom'
import SessionBestiaryReference from './SessionBestiaryReference.vue'
import { itemsApi } from '@/shared/api/itemsApi'
const { descriptor } = parse(readFileSync(new URL('./SessionBestiaryReference.vue', import.meta.url), 'utf8'))
const script = compileScript(descriptor, { id: 'bestiary' })
SessionBestiaryReference.render = new Function('Vue', compile(descriptor.template.content, { mode: 'function', prefixIdentifiers: true, bindingMetadata: script.bindings }).code)(Vue)
vi.mock('@/shared/api/itemsApi', () => ({ itemsApi: { byIds: vi.fn(async () => ({ items: [{ id: 42, name: 'Кобольд', typeId: 6, data: { combat: { hp: 5 } } }] })) } }))
vi.mock('@/stores/itemTypes', () => ({ useItemTypesStore: () => ({ ensureType: async () => ({ id: 6, fields: [{ key: 'combat' }] }) }) }))
vi.mock('@/features/items/list-components/HandbookListItem.vue', () => ({ default: { props: ['item', 'type'], setup: props => () => h('article', { 'data-item': props.item.id, 'data-fields': props.type.fields.length }, props.item.name) } }))
vi.mock('@/features/handbook/components/ItemViewModal.vue', () => ({ default: { props: ['itemId', 'itemTypeId'], setup: props => () => h('dialog', { 'data-item': props.itemId, 'data-type': props.itemTypeId }) } }))
const flush = async () => { await Promise.resolve(); await nextTick(); await Promise.resolve(); await nextTick() }
function mount(itemId = 42) {
  const node = (type, text = '') => ({ type, text, props: {}, children: [], parent: null, focus() {} })
  const renderer = createRenderer({
    setScopeId() {},
    createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
    setText: (el, text) => { el.text = text }, setElementText: (el, text) => { el.text = text; el.children = [] },
    patchProp: (el, key, previous, value) => { el.props[key] = value },
    parentNode: el => el.parent, nextSibling: el => el.parent?.children[el.parent.children.indexOf(el) + 1] || null,
    insert(el, parent, anchor = null) {
      if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1)
      el.parent = parent
      const index = anchor ? parent.children.indexOf(anchor) : -1
      if (index < 0) parent.children.push(el); else parent.children.splice(index, 0, el)
    },
    remove(el) { if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1) },
  })

  const root = node('root')
  const app = renderer.createApp({ render: () => h(SessionBestiaryReference, { itemId, fallbackName: 'Существо' }) })
  app.provide(Vue.ssrContextKey, { modules: new Set() }); app.mount(root)
  function all(test, el = root) { return [...(test(el) ? [el] : []), ...el.children.flatMap(child => all(test, child))] }
  return { all, unmount: () => app.unmount() }
}
describe('NPC bestiary reference', () => {
  it('loads the full item schema for the canonical row and opens that handbook entry', async () => {
    const form = mount(); await flush()
    expect(form.all(el => el.type === 'article')[0].props).toMatchObject({ 'data-item': 42, 'data-fields': 1 })
    expect(form.all(el => el.type === 'dialog')).toHaveLength(0)
    form.all(el => el.type === 'button')[0].props.onClick(); await flush()
    expect(form.all(el => el.type === 'dialog')[0].props).toMatchObject({ 'data-item': 42, 'data-type': 6 }); form.unmount()
  })
  it('keeps failed references clickable so the handbook dialog can retry', async () => {
    itemsApi.byIds.mockRejectedValueOnce(new Error('Offline'))
    const form = mount(); await flush()
    form.all(el => el.type === 'button')[0].props.onClick(); await flush()
    expect(form.all(el => el.type === 'dialog')[0].props['data-item']).toBe(42); form.unmount()
  })
})

vi.mock('@sylvieshare/share-ui', async importOriginal => ({ ...await importOriginal(), LoadingIndicator: { props: ['label'], setup: props => () => h('span', { role: 'status' }, props.label) } }))
