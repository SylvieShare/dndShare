import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./CharacterSheetModal.vue', import.meta.url)), 'utf8')

describe('embedded character sheet presentation', () => {
  it('uses the shared dotted app canvas without opaque inner covers', () => {
    expect(source).toContain('class="csm share-app-canvas"')
    expect(source).toContain('.csm-body {')
    expect(source).toContain('.container {')
    expect(source.match(/background: transparent;/g)).toHaveLength(2)
    expect(source).not.toContain('background: var(--bg);')
  })

  it('can render a local draft without enabling sheet mutations', () => {
    expect(source).toContain('draft: { type: Object, default: null }')
    expect(source).toContain('loadPreview(props.draft)')
    expect(source).toContain('!previewMode.value && (isOwner.value || props.isDm)')
    expect(source).toContain('if (previewMode.value) return')
    expect(source).not.toContain(':inert="previewMode"')
    expect(source).toContain("button[title='Редактировать']")
    expect(source).toContain('Предпросмотр черновика · только чтение')
  })

  it('persists direct block mutations such as the Rage toggle', () => {
    expect(source).toContain('updateValue, updateValues, updateVar')
    expect(source).toContain('charCtx.updateValues = updateValuesAndSave')
    expect(source).toContain('function updateValuesAndSave(patch)')
    expect(source).toContain('if (!canEdit.value) return')
    expect(source).toContain('updateValues(patch)')
    expect(source).toContain('scheduleSave()')
  })
})
