import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import AbilityRuleFields from './AbilityRuleFields.vue'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'

async function render(hideLabelFor) {
  const app = createSSRApp(AbilityRuleFields, {
    fields: [{ key: 'usage', name: 'Ограничения', type: 'object', fields: [{ key: 'title', name: 'Условие', type: 'string' }] }],
    data: { usage: { title: 'В лёгкой броне' } },
    hideLabelFor,
  })
  app.provide(itemFieldEditorKey, {})
  return renderToString(app)
}
describe('ability block labels', () => {
  it('removes only the repeated block label, retaining nested labels and the group name', async () => {
    const html = await render('usage')
    expect(html).toContain('aria-label="Ограничения"')
    expect(html).not.toMatch(/class="form-field-label"[^>]*>Ограничения/)
    expect(html).toMatch(/class="form-field-label"[^>]*>Условие/)
    expect(html).toContain('В лёгкой броне')
  })
  it('keeps normal field labels outside a titled block', async () => {
    expect(await render('')).toMatch(/class="form-field-label"[^>]*>Ограничения/)
  })
})
