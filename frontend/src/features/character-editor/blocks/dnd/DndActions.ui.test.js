import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const blockSource = readFileSync(fileURLToPath(new URL('./DndActions.vue', import.meta.url)), 'utf8')
const viewSource = readFileSync(fileURLToPath(new URL('./components/DndActionsView.vue', import.meta.url)), 'utf8')
const editorSource = readFileSync(fileURLToPath(new URL('./components/DndActionsEditor.vue', import.meta.url)), 'utf8')

describe('character action block', () => {
  it('groups action economy, uses source icons and resolves linked action tooltips', () => {
    expect(viewSource).toContain('v-for="group in groups"')
    expect(viewSource).toContain('Источник: {{ action.source_label }}')
    expect(viewSource).toContain('v-for="requirement in action.requirements"')
    expect(viewSource).toContain('<ItemIcon v-if="action.item"')
    expect(viewSource).toContain('showActionTooltip($event, linked)')
    expect(viewSource).toContain('<ItemTooltip')
    expect(viewSource).toContain('title="Действия" :show-edit="false"')
  })

  it('adds actions inside each group and edits or reorders them through row menus', () => {
    expect(viewSource).toContain('class="dav-add"')
    expect(viewSource).toContain('Переместить выше')
    expect(viewSource).toContain('Переместить ниже')
    expect(viewSource).toContain('action="edit"')
    expect(editorSource).toContain('title="Своё действие"')
    expect(blockSource).toContain("makeUid('action')")
    expect(blockSource).toContain("emit('update:value', 'action_order', next)")
    expect(viewSource).not.toContain('Использовать')
  })
})
