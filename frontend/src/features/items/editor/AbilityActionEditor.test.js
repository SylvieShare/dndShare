import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import AbilityEditor from './AbilityEditor.vue'
import schema from '../../../../../resources/items/item_4_shema.json'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
vi.mock('@/shared/ui/InputDescription.vue', () => ({ default: { props: ['value'], render() { return h('textarea', { value: this.value }) } } }))
vi.mock('@/shared/api/http', () => ({ fetchGet: vi.fn().mockResolvedValue({ references: [], items: [], types: [] }), fetchPut: vi.fn(), fetchPost: vi.fn(), fetchDelete: vi.fn() }))

describe('action dependency form', () => {
  it('renders separate action cards without nested list editors and hides unused resource controls', async () => {
    const data = { feature_actions: [{title:'Первое', key:'one'}, {title:'Второе',key:'two'}] }
    const app=createSSRApp({ render: () => h(AbilityEditor, { fields:schema.filter(field=>field.key==='feature_actions'),data,typeId:4 }) })
    app.use(createPinia())
    app.provide(itemFieldEditorKey,{itemData:data,itemName:'Способность',zIndex:4500})
    const html=await renderToString(app)
    expect(html).toContain('Действие на листе · Первое')
    expect(html).toContain('Действие на листе · Второе')
    expect(html).not.toContain('Добавить запись')
    expect(html).not.toContain('Источник расхода')
    expect(html).not.toContain('Использований за одно действие')
    expect(html).toContain('Вставить стандартное действие')
    expect(html).toContain('Открыть действие позже')
  })
})
