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
})
