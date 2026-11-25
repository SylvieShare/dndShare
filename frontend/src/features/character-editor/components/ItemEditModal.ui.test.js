import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { renderComponent } from '../../../../tests/unit/renderComponent'
import CatalogueFields from '@/features/items/editor/catalogue/CatalogueFields.vue'
import { itemFieldEditorKey } from './useItemFieldEditor'

describe('handbook item editor schema fields', () => {
  it('marks the required reference, displays the saved item and omits derived fields', async () => {
    const fields = [
      { key: 'parent', name: 'Родитель', type: 'item', item_type: 8, required: true },
      { key: 'derived', name: 'Расчётное поле', type: 'text', readonly: true },
      { key: 'note', name: 'Примечание', type: 'textarea' },
    ]
    const data = { parent: { id: 42 }, note: 'Две строки' }
    const html = await renderComponent(CatalogueFields, { typeId: 16, fields, data, rootData: data }, {
      plugins: [createPinia()],
      provide: [[itemFieldEditorKey, { itemRefLabel: id => id === 42 ? 'Эльф' : '', zIndex: 4500 }]],
    })
    expect(html).toMatch(/<button[^>]*aria-required="true"[^>]*>Эльф<\/button>/)
    expect(html).not.toContain('Расчётное поле')
    expect(html).toMatch(/<textarea[^>]*>Две строки<\/textarea>/)
  })
})
