import { readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const srcDir = fileURLToPath(new URL('..', import.meta.url))
const fontPath = fileURLToPath(new URL('./fonts.css', import.meta.url))
const fontSource = readFileSync(fontPath, 'utf8')
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
    expect(fontSource).toContain('font-family: "Cormorant Garamond"')
    expect(fontSource).toContain('font-family: "Literata"')
    expect(fontSource).toContain('font-weight: 500 700')
    expect(fontSource).toContain('font-weight: 400 700')
    expect(fontSource).not.toContain('https://')
    const localFaces = [...fontSource.matchAll(/src:\s*url\("([^"]+)"\)/g)]
    expect(localFaces).toHaveLength(3)
    expect(localFaces.every(match => match[1].startsWith('/static/fonts/'))).toBe(true)
  })

  it('does not bypass typography tokens with component-local font stacks', () => {
    const forbidden = /font(?:-family)?\s*:\s*[^;}]*(?:Arial|Georgia|Times New Roman|Cormorant Garamond|\bmonospace\b)/
    const violations = styleSources
      .filter(({ path, source }) => path !== fontPath && forbidden.test(source))
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
