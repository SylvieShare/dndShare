import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./StepBackground.vue', import.meta.url)), 'utf8')

describe('background step presentation', () => {
  it('renders illustrated backgrounds in a two-column grid', () => {
    expect(source).toContain('<BackgroundSelectCard')
    expect(source).toContain('.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr))')
    expect(source).toContain('@media (max-width: 700px) { .grid { grid-template-columns: minmax(0, 1fr); } }')
  })

  it('uses the dedicated cover and never stretches the compact icon', () => {
    expect(source).toContain(':image-url="b.coverImageUrl || \'\'"')
    expect(source).not.toContain('iconImageUrl')
  })
})
