import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./MorphEditorShell.vue', import.meta.url)), 'utf8')

describe('MorphEditorShell mobile layout', () => {
  it('keeps vertical editors full-height with a surface preview and form backing', () => {
    expect(source).toMatch(/\.mes-split \{ flex-direction: column; min-height: 100%; background: var\(--surface\); \}/)
    expect(source).toMatch(/\.mes-rest \{[\s\S]*?background: var\(--bg\);/)
    expect(source).toMatch(/\.mes-vertical \.mes-rest \{ flex: 1 0 auto; \}/)
  })
})
