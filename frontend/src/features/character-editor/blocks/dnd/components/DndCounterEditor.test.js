import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./DndCounterEditor.vue', import.meta.url)), 'utf8')

describe('DndCounterEditor', () => {
  it('blurs both counter text fields when FormTextInput emits Enter', () => {
    const textFields = source.match(/<FormTextInput[\s\S]*?\/>/g) || []

    expect(textFields).toHaveLength(2)
    expect(textFields).toEqual(expect.arrayContaining([
      expect.stringContaining('@enter="blurOnEnter"'),
    ]))
    expect(textFields.every(field => field.includes('@enter="blurOnEnter"'))).toBe(true)
    expect(source).toMatch(/function blurOnEnter\(event\)\s*\{\s*event\.target\.blur\(\)\s*\}/)
  })
})
