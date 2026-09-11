import { readFileSync } from 'node:fs'
import * as Vue from 'vue'
import { createRenderer, h, nextTick } from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
import { compile } from '@vue/compiler-dom'
import { describe, expect, it, vi } from 'vitest'
import DndLvlEditor from './DndLvlEditor.vue'

const { descriptor } = parse(readFileSync(new URL('./DndLvlEditor.vue', import.meta.url), 'utf8'))
const script = compileScript(descriptor, { id: 'level-experience' })
DndLvlEditor.render = new Function('Vue', compile(descriptor.template.content, {
  mode: 'function', prefixIdentifiers: true, bindingMetadata: script.bindings,
}).code)(Vue)

vi.mock('@sylvieshare/share-ui', () => ({
  EditorPanel: { setup: (_, { slots }) => () => h('section', slots.default?.()) },
  ActionButton: { setup: (_, { slots }) => () => h('button', slots.default?.()) },
  FormField: { setup: (_, { slots }) => () => h('div', slots.default?.()) },
  FormNumberInput: { setup: () => () => h('input') },
  ConfirmDialog: {
    props: ['message', 'title'], emits: ['confirm', 'cancel'],
    setup: (props, { emit }) => () => h('dialog', {
      message: props.message, onConfirm: () => emit('confirm'), onCancel: () => emit('cancel'),
    }),
  },
}))
vi.mock('@/features/character-editor/components/CalcPad', () => ({ default: { setup: () => () => h('div') } }))

function mount(data) {
  const node = type => ({ type, props: {}, children: [], parent: null })
  const renderer = createRenderer({
    setScopeId() {}, createElement: node, createText: node, createComment: node,
    setText() {}, setElementText: (el, text) => { el.text = text },
    patchProp: (el, key, _, value) => { el.props[key] = value },
    parentNode: el => el.parent,
    nextSibling: el => el.parent?.children[el.parent.children.indexOf(el) + 1] || null,
    insert(el, parent, anchor) {
      if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1)
      el.parent = parent
      const index = anchor ? parent.children.indexOf(anchor) : -1
      if (index < 0) parent.children.push(el)
      else parent.children.splice(index, 0, el)
    },
    remove(el) { if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1) },
  })
  const root = node('root'), levelup = vi.fn(), change = vi.fn()
  const app = renderer.createApp({ render: () => h(DndLvlEditor, { data, onLevelup: levelup, onChange: change }) })
  app.provide(Vue.ssrContextKey, { modules: new Set() })
  app.mount(root)
  const all = (type, el = root) => [...(el.type === type ? [el] : []), ...el.children.flatMap(child => all(type, child))]
  return { levelup, change, all, button: all('button').find(el => el.props.class?.includes('lved-levelup')), unmount: () => app.unmount() }
}

describe('experience level-up action', () => {
  it('keeps an insufficient-XP button muted and clickable, requiring confirmation before opening the level-up flow', async () => {
    const data = { level: 2, exp: 400 }
    const form = mount(data)
    expect(form.button.props.disabled).toBe(false)
    expect(form.button.props.class).not.toContain('lved-levelup-ready')
    form.button.props.onClick()
    await nextTick()
    expect(form.levelup).not.toHaveBeenCalled()
    const dialog = form.all('dialog')[0]
    expect(dialog.props.message).toContain('500 опыта')
    expect(dialog.props.message).toContain('900')
    dialog.props.onConfirm()
    await nextTick()
    expect(form.levelup).toHaveBeenCalledExactlyOnceWith(900)
    expect(form.change).not.toHaveBeenCalled()
    expect(data).toEqual({ level: 2, exp: 400 })
    expect(form.all('dialog')).toHaveLength(0)
    form.unmount()
  })

  it('cancels the confirmation without changing XP or opening level-up', async () => {
    const form = mount({ level: 1, exp: 50 })
    form.button.props.onClick()
    await nextTick()
    form.all('dialog')[0].props.onCancel()
    await nextTick()
    expect(form.change).not.toHaveBeenCalled()
    expect(form.levelup).not.toHaveBeenCalled()
    expect(form.all('dialog')).toHaveLength(0)
    form.unmount()
  })

  it.each([900, 1500])('opens level-up directly when XP is sufficient (%i)', async exp => {
    const form = mount({ level: 2, exp })
    expect(form.button.props.class).toContain('lved-levelup-ready')
    form.button.props.onClick()
    await nextTick()
    expect(form.levelup).toHaveBeenCalledExactlyOnceWith()
    expect(form.all('dialog')).toHaveLength(0)
    form.unmount()
  })

  it('keeps the maximum-level action visible without offering level 21', () => {
    const form = mount({ level: 20, exp: 355000 })
    expect(form.button.text).toBe('Максимальный уровень')
    expect(form.button.props.disabled).toBe(true)
    form.button.props.onClick()
    expect(form.levelup).not.toHaveBeenCalled()
    form.unmount()
  })
})
