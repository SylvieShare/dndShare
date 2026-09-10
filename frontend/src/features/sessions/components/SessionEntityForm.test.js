import { createRenderer, defineComponent, h, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import { compile } from '@vue/compiler-dom'
import SessionEntityForm from './SessionEntityForm.vue'
import SessionEditableField from './SessionEditableField.vue'
import UniversalRelationList from './UniversalRelationList.vue'
import SessionMaterialPreview from './SessionMaterialPreview.vue'
import SessionEntityFormHeader from './SessionEntityFormHeader.vue'
import SessionEntityFormBody from './SessionEntityFormBody.vue'
import SessionEntityFormField from './SessionEntityFormField.vue'
import SessionEntityFormVisual from './SessionEntityFormVisual.vue'

// Vitest's Node transform supplies SSR setup; attach the client templates to
// exercise the real event handlers with Vue's in-memory renderer.
for (const [component, file] of [[SessionEntityForm, './SessionEntityForm.vue'], [SessionEditableField, './SessionEditableField.vue'], [UniversalRelationList, './UniversalRelationList.vue'], [SessionMaterialPreview, './SessionMaterialPreview.vue'], [SessionEntityFormHeader, './SessionEntityFormHeader.vue'], [SessionEntityFormBody, './SessionEntityFormBody.vue'], [SessionEntityFormField, './SessionEntityFormField.vue'], [SessionEntityFormVisual, './SessionEntityFormVisual.vue']]) {
  const { descriptor } = parse(readFileSync(new URL(file, import.meta.url), 'utf8'))
  const script = compileScript(descriptor, { id: file })
  const { code } = compile(descriptor.template.content, { mode: 'function', prefixIdentifiers: true, bindingMetadata: script.bindings })
  component.render = new Function('Vue', code)(Vue)
}


vi.mock('@sylvieshare/share-ui', async importOriginal => {
  const { h } = await import('vue')
  return {
    ...(await importOriginal()),
    LoadingIndicator: { props: ['label'], setup: props => () => h('span', { role: 'status' }, props.label) },
    LoadingState: { props: ['label'], setup: props => () => h('div', { role: 'status' }, props.label) },
    ActionMenu: { setup: (_, { slots }) => () => h('menu', [...(slots.trigger?.({ open: true }) || []), ...(slots.default?.({ close() {} }) || [])]) },
    ActionMenuItem: { setup: (_, { slots, attrs }) => () => h('button', attrs, slots.default?.()) },
    AppModalFrame: { setup: (_, { slots }) => () => h('dialog', [...(slots.default?.() || []), ...(slots.footer?.() || [])]) },
    FormSelect: { props: ['value'], emits: ['update:value'], setup: (props, { emit, slots }) => () => h('select', { value: props.value, onChange: event => emit('update:value', event.target.value) }, slots.default?.()) },
    ColorPresetPicker: { render: () => h('div') },
    AddButton: { props: ['label'], emits: ['click'], setup: (props, { emit }) => () => h('button', { 'aria-label': props.label, onClick: () => emit('click') }) },
    RemoveButton: { props: ['label'], emits: ['click'], setup: (props, { emit }) => () => h('button', { 'aria-label': props.label, onClick: () => emit('click') }) },
    FormActionButtons: { props: ['canSubmit'], emits: ['submit', 'cancel'], setup: (props, { emit }) => () => h('footer', [h('button', { 'aria-label': 'Сохранить всё', disabled: !props.canSubmit, onClick: () => emit('submit') }), h('button', { 'aria-label': 'Отменить всё', onClick: () => emit('cancel') })]) },
  }
})
vi.mock('./SessionEntityAssetInput.vue', () => ({ default: { emits: ['update:modelValue'], setup: (_, { emit }) => () => h('button', { 'aria-label': 'Выбрать тестовое изображение', onClick: () => emit('update:modelValue', { id: 55, url: '/new.png' }) }) } }))
vi.mock('./SessionBestiaryReference.vue', () => ({ default: { render: () => null } }))
vi.mock('./UniversalRelationPickerModal.vue', () => ({ default: { render: () => null } }))
vi.mock('@/features/handbook/components/ItemPickerModal.vue', () => ({ default: { render: () => null } }))
vi.mock('@/shared/api/itemsApi', () => ({ itemsApi: { list: vi.fn(async () => ({ items: [] })) } }))

function mountForm(options = {}) {
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
  const entity = ref(options.entity || { id: 1, name: 'Поиск', status: 'planned', goal: 'Найти ключ', notes: 'Секрет', relations: [] })
  const editing = ref(false)
  const save = options.save || vi.fn(async payload => { entity.value = { ...entity.value, ...payload }; return true })
  const root = node('root')
  const app = renderer.createApp(defineComponent({ setup: () => () => h(SessionEntityForm, {
    type: options.type || 'quest', entity: entity.value, editing: editing.value, editable: options.editable ?? true,
    save, relationItems: options.items || [], onSaved: () => { editing.value = false }, onCancel: () => { editing.value = false }, onEditRequest: () => { editing.value = true },
  }) }))
  app.provide(Vue.ssrContextKey, { modules: new Set() })
  app.mount(root)
  function all(test, el = root) { return [...(test(el) ? [el] : []), ...el.children.flatMap(child => all(test, child))] }
  const byLabel = label => all(el => el.props['aria-label'] === label)[0]
  return { root, all, byLabel, entity, editing, save, unmount: () => app.unmount() }
}
const flush = async () => { await nextTick(); await Promise.resolve(); await nextTick() }

describe('shared session entity editing', () => {
  it('shows values first and saves one pencil without overwriting unrelated fields', async () => {
    const form = mountForm()
    expect(form.all(el => ['input', 'textarea', 'select'].includes(el.type))).toHaveLength(0)
    await form.byLabel('Редактировать поле «Цель»').props.onClick()
    await flush()
    form.all(el => el.type === 'textarea')[0].props.onInput({ target: { value: 'Найти дверь' } })
    await flush()
    await form.byLabel('Сохранить').props.onClick()
    await flush()
    expect(form.save).toHaveBeenCalledWith(expect.objectContaining({ goal: 'Найти дверь', notes: 'Секрет', name: 'Поиск' }))
    expect(form.all(el => el.type === 'textarea')).toHaveLength(0)
    form.unmount()
  })

  it('keeps a failed edit open and lets the user retry the same draft', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('Сбой сохранения')).mockResolvedValue(true)
    const form = mountForm({ save })
    form.byLabel('Редактировать поле «Цель»').props.onClick()
    await flush()
    form.all(el => el.type === 'textarea')[0].props.onInput({ target: { value: 'Новая цель' } })
    await flush()
    await form.byLabel('Сохранить').props.onClick()
    await flush()
    expect(form.all(el => el.type === 'textarea')[0].props.value).toBe('Новая цель')
    expect(form.all(el => el.props.role === 'alert').some(el => el.text === 'Сбой сохранения')).toBe(true)
    await form.byLabel('Сохранить').props.onClick()
    await flush()
    expect(save).toHaveBeenCalledTimes(2)
    expect(form.all(el => el.type === 'textarea')).toHaveLength(0)
    form.unmount()
  })

  it('expands all fields in place and discards the full draft on cancel', async () => {
    const form = mountForm()
    form.editing.value = true
    await flush()
    expect(form.all(el => el.type === 'textarea')).toHaveLength(5)
    expect(form.all(el => el.type === 'select')).toHaveLength(1)
    expect(form.all(el => ['input', 'textarea'].includes(el.type)).every(el => el.props.placeholder?.trim())).toBe(true)
    form.all(el => el.type === 'textarea')[0].props.onInput({ target: { value: 'Несохранённое' } })
    await flush()
    form.byLabel('Отменить всё').props.onClick()
    await flush()
    expect(form.save).not.toHaveBeenCalled()
    expect(form.entity.value.goal).toBe('Найти ключ')
    expect(form.all(el => el.type === 'textarea')).toHaveLength(0)
    form.unmount()
  })

  it('removes only the chosen relation and places its trash button outside navigation', async () => {
    const form = mountForm({ entity: { id: 1, name: 'Поиск', relations: [{ type: 'npc', id: 2, note: 'Свидетель' }, { type: 'location', id: 3 }] }, items: [{ type: 'npc', id: 2, key: 'npc:2', title: 'Мира' }, { type: 'location', id: 3, key: 'location:3', title: 'Город' }] })
    const trash = form.byLabel('Удалить связь с «Мира»')
    expect(trash.parent.type).toBe('article')
    trash.props.onClick()
    await flush()
    expect(form.save).toHaveBeenCalledWith(expect.objectContaining({ relations: [{ type: 'location', id: 3 }] }))
    expect(form.byLabel('Добавить связь')).toBeDefined()
    form.unmount()
  })

  it('opens a material type change with all dependent fields and does not reuse an incompatible asset', async () => {
    const form = mountForm({ type: 'material', entity: { id: 1, kind: 'image', name: 'Карта', assetId: 9, assetUrl: '/map.png', relations: [] } })
    expect(form.all(el => el.type === 'img')).toHaveLength(2)
    form.byLabel('Редактировать поле «Тип материала»').props.onClick()
    await flush()
    form.all(el => el.type === 'select')[0].props.onChange({ target: { value: 'video' } })
    await flush()
    await form.byLabel('Сохранить').props.onClick()
    await flush()
    expect(form.editing.value).toBe(true)
    expect(form.save).not.toHaveBeenCalled()
    expect(form.all(el => el.type === 'img' || el.type === 'video')).toHaveLength(0)
    expect(form.byLabel('Сохранить всё').props.disabled).toBe(true)
    form.unmount()
  })

  it('saves all expanded quest fields together', async () => {
    const form = mountForm()
    form.editing.value = true
    await flush()
    form.all(el => el.type === 'input')[0].props.onInput({ target: { value: 'Новый заголовок' } })
    form.all(el => el.type === 'textarea')[0].props.onInput({ target: { value: 'Новая цель' } })
    await flush()
    form.byLabel('Сохранить всё').props.onClick()
    await flush()
    expect(form.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Новый заголовок', goal: 'Новая цель', notes: 'Секрет' }))
    expect(form.editing.value).toBe(false)
    form.unmount()
  })

  it('keeps NPC race and role in the header and changes the portrait through its image', async () => {
    const form = mountForm({ type: 'npc', entity: { id: 1, name: 'Мира', raceName: 'Эльф', raceItemId: 12, role: 'Проводник', imageId: 9, imageUrl: '/old.png', relations: [] } })
    const role = form.byLabel('Редактировать поле «Роль»')
    expect(role.parent.parent.parent.props.class).toContain('entity-form-heading-field')
    expect(form.byLabel('Редактировать поле «Портрет»')).toBeUndefined()
    form.all(el => el.type === 'button' && el.children.some(child => child.text === 'Заменить изображение'))[0].props.onClick()
    await flush()
    form.byLabel('Выбрать тестовое изображение').props.onClick()
    await flush()
    expect(form.save).toHaveBeenCalledWith(expect.objectContaining({ imageId: 55, role: 'Проводник', raceItemId: 12 }))
    form.unmount()
  })

  it('keeps location type beside its heading and has no parent or image field in the body', () => {
    const form = mountForm({ type: 'location', entity: { id: 1, name: 'Город', kind: 'settlement', parentLocationId: 7, imageId: 9, imageUrl: '/city.png', relations: [] } })
    const type = form.byLabel('Редактировать поле «Тип»')
    expect(type.parent.parent.parent.props.class).toContain('entity-form-heading-field')
    expect(form.byLabel('Редактировать поле «Внутри локации»')).toBeUndefined()
    expect(form.byLabel('Редактировать поле «Изображение»')).toBeUndefined()
    expect(form.byLabel('Действия с изображением')).toBeDefined()
    form.unmount()
  })

  it('clears an image immediately and allows saving an NPC without a portrait', async () => {
    const form = mountForm({ type: 'npc', entity: { id: 1, name: 'Мира', imageId: 9, imageUrl: '/old.png', relations: [] } })
    expect(form.all(el => el.text === 'Раса не выбрана').length).toBeGreaterThan(0)
    const clear = form.all(el => el.type === 'button' && el.children.some(child => child.text === 'Очистить'))[0]
    clear.props.onClick(); await flush()
    expect(form.save).toHaveBeenCalledWith(expect.objectContaining({ imageId: null }))
    expect(form.all(el => el.type === 'img')).toHaveLength(0)
    form.unmount()
  })

  it('keeps every mutation control hidden for a read-only viewer', () => {
    const form = mountForm({ editable: false })
    expect(form.all(el => el.type === 'button')).toHaveLength(0)
    form.unmount()
  })
})
