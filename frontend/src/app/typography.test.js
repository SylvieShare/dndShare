import { readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const srcDir = fileURLToPath(new URL('..', import.meta.url))
const appSource = readFileSync(fileURLToPath(new URL('../App.vue', import.meta.url)), 'utf8')
const themeSource = readFileSync(fileURLToPath(new URL('./theme.css', import.meta.url)), 'utf8')

function runtimeStyleSources(directory = srcDir) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return runtimeStyleSources(path)
    return ['.css', '.vue'].includes(extname(path)) ? [{ path, source: readFileSync(path, 'utf8') }] : []
  })
}

const styleSources = runtimeStyleSources()

describe('typography roles', () => {
  it('defines every semantic font stack in one theme', () => {
    for (const token of ['--font-prose', '--font-mono', '--font-print-ui', '--font-print-display', '--font-print-prose']) {
      expect(themeSource).toContain(`${token}:`)
    }
  })

  it('loads variable editorial faces for the supported weight ranges', () => {
    expect(appSource).toContain('Cormorant+Garamond:wght@500..700')
    expect(appSource).toContain('Literata:ital,opsz,wght@0,7..72,400..700;1,7..72,400..700')
  })

  it('does not bypass typography tokens with component-local font stacks', () => {
    const forbidden = /font(?:-family)?\s*:\s*[^;}]*(?:Arial|Georgia|Times New Roman|Cormorant Garamond|\bmonospace\b)/
    const violations = styleSources
      .filter(({ source }) => forbidden.test(source))
      .map(({ path }) => relative(srcDir, path))
    expect(violations).toEqual([])
  })

  it('keeps display-face requests within the font supported weight range', () => {
    const violations = []
    for (const { path, source } of styleSources) {
      for (const block of source.split(/[{}]/)) {
        if (!block.includes('var(--font-display)')) continue
        const weight = Number(block.match(/font-weight:\s*(\d+)/)?.[1])
        if (weight > 700) violations.push(`${relative(srcDir, path)}:${weight}`)
      }
    }
    expect(violations).toEqual([])
  })
})
