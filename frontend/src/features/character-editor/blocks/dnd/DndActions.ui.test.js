import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const blockSource = readFileSync(fileURLToPath(new URL('./DndActions.vue', import.meta.url)), 'utf8')
const viewSource = readFileSync(fileURLToPath(new URL('./components/DndActionsView.vue', import.meta.url)), 'utf8')
const editorSource = readFileSync(fileURLToPath(new URL('./components/DndActionsEditor.vue', import.meta.url)), 'utf8')

describe('character action block', () => {
  it('groups action economy and exposes source requirements as readonly context', () => {
    expect(viewSource).toContain('v-for="group in groups"')
    expect(viewSource).toContain('Источник: {{ action.source_label }}')
    expect(viewSource).toContain('v-for="requirement in action.requirements"')
    expect(editorSource).toContain('title="Из способностей"')
    expect(editorSource).toContain('Только чтение')
  })

  it('keeps manual actions editable and can consume a bound source resource', () => {
    expect(editorSource).toContain('title="Свои действия"')
    expect(blockSource).toContain("makeUid('action')")
    expect(blockSource).toContain('characterResources?.setAvailable')
    expect(blockSource).toContain("type: 'feature_action'")
  })
})
