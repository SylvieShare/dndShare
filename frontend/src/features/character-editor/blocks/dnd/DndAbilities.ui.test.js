import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const blockSource = readFileSync(fileURLToPath(new URL('./DndAbilities.vue', import.meta.url)), 'utf8')
const viewSource = readFileSync(fileURLToPath(new URL('./components/DndAbilitiesView.vue', import.meta.url)), 'utf8')

describe('ability rows', () => {
  it('renders contextual passive text under the ability that owns it', () => {
    expect(blockSource).toContain('effect?.source?.valueId === props.block.id')
    expect(blockSource).toContain('...passiveEffectsFor(s)')
    expect(blockSource).toContain('Требования не выполнены')
    expect(viewSource).toContain('v-for="effect in entry.passive_effects || []"')
    expect(viewSource).toContain('<b>{{ effect.title }}</b>')
  })

  it('supports expanded cards with 64px item art and inline descriptions', () => {
    expect(blockSource).toContain(':expanded="!!block.content?.expanded"')
    expect(blockSource).toContain('item,')
    expect(viewSource).toContain(':item="entry.item" :size="64"')
    expect(viewSource).toContain('expanded && entry.desc')
    expect(viewSource).toMatch(/\.abv--expanded \.abv-card \{[^}]*grid-template-columns: 64px minmax\(0, 1fr\) auto;/)
  })
})
