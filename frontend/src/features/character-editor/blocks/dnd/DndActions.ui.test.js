import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const blockSource = readFileSync(fileURLToPath(new URL('./DndActions.vue', import.meta.url)), 'utf8')
const viewSource = readFileSync(fileURLToPath(new URL('./components/DndActionsView.vue', import.meta.url)), 'utf8')
const editorSource = readFileSync(fileURLToPath(new URL('./components/DndActionsEditor.vue', import.meta.url)), 'utf8')
const resourcesSource = readFileSync(fileURLToPath(new URL('../generic/BlockResources.vue', import.meta.url)), 'utf8')

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

  it('manages all custom actions from the block morph without row reordering controls', () => {
    expect(viewSource).not.toContain('class="dav-add"')
    expect(blockSource).toContain('<BaseTile class="da-tile">')
    expect(blockSource).toContain(':readonly-actions="readonlyActions"')
    expect(viewSource).not.toContain('Переместить выше')
    expect(viewSource).not.toContain('Переместить ниже')
    expect(viewSource).toContain('action="edit"')
    expect(editorSource).toContain('title="Свои действия"')
    expect(editorSource).toContain('title="Из листа"')
    expect(editorSource).toContain('Добавить действие')
    expect(editorSource).toContain('@input="change(action.uid, { requirements: draftLines($event.target.value) })"')
    expect(editorSource).toContain('@blur="change(action.uid, { requirements: lines($event.target.value) })"')
    expect(blockSource).toContain("makeUid('action')")
    expect(blockSource).not.toContain('function moveAction(')
    expect(viewSource).not.toContain('Использовать')
    expect(viewSource).not.toContain('<span>Добавить</span>')
  })

  it('omits empty action types from the sheet view', () => {
    expect(blockSource).toContain('groupCharacterFeatureActions(actions.value)')
    expect(blockSource).not.toContain('groupCharacterFeatureActions(actions.value, ownerMode.value)')
  })

  it('applies generic source action consequences from the row menu', () => {
    expect(viewSource).toContain(':disabled="!canOpenActionMenu(action)"')
    expect(viewSource).toContain("'dav-action--clickable': canOpenActionMenu(action)")
    expect(viewSource).toContain('function canOpenActionMenu(action)')
    expect(viewSource).toContain('.dav-action:not(.dav-action--clickable)')
    expect(viewSource).toContain('v-for="effect in action.menu_effects || []"')
    expect(viewSource).toContain("emit('apply-effect', action, effect)")
    expect(blockSource).toContain('@apply-effect="applyActionEffect"')
    expect(blockSource).toContain('featureActionEffectPatch(props.values || {}, effect)')
  })

  it('spends a resource linked to a source action from the same row menu', () => {
    expect(viewSource).toContain('v-if="canSpendResource(action)"')
    expect(viewSource).toContain('Потратить {{ action.resource_cost }}: {{ action.resource.title }}')
    expect(viewSource).toContain("emit('spend-resource', action)")
    expect(blockSource).toContain('@spend-resource="spendActionResource"')
    expect(blockSource).toContain('characterResources?.setAvailable?.(action.resource.key, remaining)')
  })

  it('renders linked resources as colored interactive spheres with rest rules', () => {
    expect(viewSource).not.toContain('<span v-if="action.resource" class="dav-resource"')
    expect(viewSource).toContain('v-if="resourceTotal(action) === 1"')
    expect(viewSource).toContain('v-if="resourceTotal(action) > 1"')
    expect(viewSource).toContain(':color="action.resource.color_point || undefined"')
    expect(viewSource).toContain('<span class="dav-title-row">')
    expect(viewSource).toContain('<ResourceRestIcons v-if="action.resource" :resource="action.resource" />')
    expect(viewSource).toContain("$emit('toggle-resource', action, pip)")
    expect(viewSource.match(/@pointerdown\.stop/g)).toHaveLength(2)
    expect(viewSource).toContain('.ram-custom-trigger:has(.dav-resource:active)')
    expect(blockSource).toContain('@toggle-resource="toggleActionResource"')
    expect(resourcesSource).toContain('featureActionResourceKeys(')
    expect(resourcesSource).toContain('!actionResourceKeys.value.has(String(resource.key))')
  })
})
