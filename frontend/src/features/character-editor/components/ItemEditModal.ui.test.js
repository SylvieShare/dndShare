import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const modal = readFileSync(fileURLToPath(new URL('./ItemEditModal.vue', import.meta.url)), 'utf8')
const field = readFileSync(fileURLToPath(new URL('./ItemSchemaField.vue', import.meta.url)), 'utf8')

describe('handbook item editor schema constraints', () => {
  it('hides derived fields and blocks submit until required references are selected', () => {
    expect(modal).toContain('typeFields.value.filter(field => !field.readonly)')
    expect(modal).toContain('const missingRequiredFields = computed')
    expect(modal).toContain("if (field.type === 'item') return !(Number(value) > 0)")
    expect(modal).toContain(':disabled="!canSubmit || saving"')
    expect(modal).toContain('Заполните обязательные поля')
    expect(field).toContain('v-if="field.required"')
    expect(field).toContain(':aria-required="field.required || undefined"')
  })
})
