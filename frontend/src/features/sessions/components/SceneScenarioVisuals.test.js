import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const editor = read('./SceneEditorModal.vue')
const node = read('./SceneGraphNode.vue')
const picker = read('./SessionImagePicker.vue')

describe('scenario location and image fallback', () => {
  it('lets a scenario select a location and inherit its image', () => {
    expect(editor).toContain('label="Локация"')
    expect(editor).toContain('locationId: draft.locationId ? Number(draft.locationId) : null')
    expect(editor).toContain('allow-empty')
    expect(editor).toContain('Из локации')
    expect(picker).toContain('!props.allowEmpty && !props.modelValue')
  })

  it('does not show a generated scenario number on the card', () => {
    expect(node).not.toContain('scene-graph-node-index')
    expect(node).not.toContain('String(index + 1)')
  })
})
