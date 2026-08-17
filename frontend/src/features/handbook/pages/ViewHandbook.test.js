import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(fileURLToPath(new URL('./styles/ViewHandbook.css', import.meta.url)), 'utf8')
const landingStyles = readFileSync(fileURLToPath(new URL('./styles/HandbookLanding.css', import.meta.url)), 'utf8')
const dictionaryView = readFileSync(fileURLToPath(new URL('../dictionary/ViewDictionary.vue', import.meta.url)), 'utf8')

describe('handbook canvas', () => {
  it('keeps page wrappers transparent so the shared dot pattern stays visible', () => {
    const outer = styles.match(/\.handbook-outer\s*\{([^}]*)\}/)?.[1] || ''
    const page = styles.match(/\.handbook-page\s*\{([^}]*)\}/)?.[1] || ''

    expect(outer).toContain('background: transparent;')
    expect(page).toContain('background: transparent;')
    expect(outer).not.toContain('background: var(--bg);')
    expect(page).not.toContain('background: var(--bg);')
  })

  it('uses the current app-header height instead of reserving the removed desktop header', () => {
    for (const source of [styles, landingStyles, dictionaryView]) {
      expect(source).toContain('calc(100dvh - var(--header-h))')
      expect(source).not.toContain('calc(100vh - 54px)')
    }
  })
})
