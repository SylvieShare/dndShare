import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./DndCreateWizard.vue', import.meta.url)), 'utf8')
const modalSource = readFileSync(fileURLToPath(new URL('../CharacterCreateModal.vue', import.meta.url)), 'utf8')

describe('compact character creation wizard', () => {
  it('finishes without a duplicate review step and previews the real read-only sheet', () => {
    expect(source).not.toContain("key: 'review'")
    expect(source).not.toContain("stepKey === 'review'")
    expect(source).toContain('Предпросмотр листа')
    expect(source).toContain('<CharacterSheetModal')
    expect(source).toContain(':draft="previewDraft"')
    expect(source).toContain('userId: null')
    expect(modalSource).toContain(':template-name="selectedTemplate?.name || \'\'"')
    expect(modalSource).toContain(':source-version-id="sourceVersionId"')
  })
})
