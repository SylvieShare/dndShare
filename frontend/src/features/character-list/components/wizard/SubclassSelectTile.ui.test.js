import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./SubclassSelectTile.vue', import.meta.url)), 'utf8')

describe('archetype selection tile', () => {
  it('shows the archetype icon, concise description and granted benefits', () => {
    expect(source).toContain('<ItemIcon v-if="item.iconImageUrl || item.svg"')
    expect(source).toContain('subclass-tile-description')
    expect(source).toContain('subclass-tile-benefits-label">Даёт')
    expect(source).toContain('v-for="benefit in benefits"')
  })

  it('keeps a persistent selected state', () => {
    expect(source).toContain("'subclass-tile--selected': selected")
    expect(source).toContain(':aria-pressed="selected"')
    expect(source).toContain('Выбрано')
  })
})
