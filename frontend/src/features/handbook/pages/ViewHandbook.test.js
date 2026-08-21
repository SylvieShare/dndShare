import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(fileURLToPath(new URL('./styles/ViewHandbook.css', import.meta.url)), 'utf8')
const landingStyles = readFileSync(fileURLToPath(new URL('./styles/HandbookLanding.css', import.meta.url)), 'utf8')
const landingSource = readFileSync(fileURLToPath(new URL('./HandbookLanding.vue', import.meta.url)), 'utf8')
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

  it('reserves the final landing width before handbook catalogues load', () => {
    const landing = landingStyles.match(/\.hb-landing\s*\{([^}]*)\}/)?.[1] || ''

    expect(landing).toContain('width: 100%;')
    expect(landing).toContain('max-width: 1400px;')
    expect(landing).toContain('box-sizing: border-box;')
  })

  it('gives every collection a double-width card and groups related catalogues', () => {
    const grid = landingStyles.match(/\.hb-collections-grid\s*\{([^}]*)\}/)?.[1] || ''
    const cardTop = landingStyles.match(/\.hb-card-top\s*\{([^}]*)\}/)?.[1] || ''

    expect(grid).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));')
    expect(cardTop).toContain('padding-right: 156px;')
    expect(landingSource).toContain('v-for="group in collectionGroups"')
    expect(landingSource).toContain("name: 'Основные разделы'")
    expect(landingSource).toContain('const featureTypeIds = new Set([3, 4, 7])')
    expect(landingSource).toContain("name: 'Способности и черты'")
    expect(landingSource).toContain('item-level data: race_ids/subrace_ids and class_ids/subclass_ids')
    expect(landingSource).toContain('types: [root, ...descendants]')
    expect(landingSource).not.toContain("'hb-collection-card--wide': type.important")
  })
})
