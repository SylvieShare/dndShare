import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(fileURLToPath(new URL('./styles/ViewHandbook.css', import.meta.url)), 'utf8')

describe('handbook canvas', () => {
  it('keeps page wrappers transparent so the shared dot pattern stays visible', () => {
    const outer = styles.match(/\.handbook-outer\s*\{([^}]*)\}/)?.[1] || ''
    const page = styles.match(/\.handbook-page\s*\{([^}]*)\}/)?.[1] || ''

    expect(outer).toContain('background: transparent;')
    expect(page).toContain('background: transparent;')
    expect(outer).not.toContain('background: var(--bg);')
    expect(page).not.toContain('background: var(--bg);')
  })
})
