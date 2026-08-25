import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const blockSource = readFileSync(fileURLToPath(new URL('./DndActions.vue', import.meta.url)), 'utf8')
const viewSource = readFileSync(fileURLToPath(new URL('./components/DndActionsView.vue', import.meta.url)), 'utf8')
const editorSource = readFileSync(fileURLToPath(new URL('./components/DndActionsEditor.vue', import.meta.url)), 'utf8')

describe('character action block', () => {
  it('groups action economy, uses source icons and resolves linked action tooltips', () => {
    expect(viewSource).toContain('v-for="group in groups"')
    expect(viewSource).not.toContain('Источник: {{ action.source_label }}')
    expect(viewSource).toContain('v-for="requirement in action.requirements"')
    expect(viewSource).toContain('<ItemIcon v-if="action.item"')
    expect(viewSource).toContain('showActionTooltip($event, linked)')
    expect(viewSource).toContain('<ItemTooltip')
    expect(viewSource).toContain(':show-edit="manage"')
    expect(viewSource).toContain('@edit="$emit(\'manage\')"')
  })

  it('manages all custom actions from the block morph and keeps row reordering', () => {
    expect(viewSource).not.toContain('class="dav-add"')
    expect(blockSource).toContain('<BaseTile class="da-tile">')
    expect(blockSource).toContain(':readonly-actions="readonlyActions"')
    expect(viewSource).toContain('Переместить выше')
    expect(viewSource).toContain('Переместить ниже')
    expect(viewSource).toContain('action="edit"')
    expect(editorSource).toContain('title="Свои действия"')
    expect(editorSource).toContain('title="Из листа"')
    expect(editorSource).toContain('Добавить действие')
    expect(blockSource).toContain("makeUid('action')")
    expect(blockSource).toContain("emit('update:value', 'action_order', next)")
    expect(viewSource).not.toContain('Использовать')
    expect(viewSource).not.toContain('<span>Добавить</span>')
  })

  it('omits empty action types from the sheet view', () => {
    expect(blockSource).toContain('groupCharacterFeatureActions(actions.value)')
    expect(blockSource).not.toContain('groupCharacterFeatureActions(actions.value, ownerMode.value)')
  })
})
