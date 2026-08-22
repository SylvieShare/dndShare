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
})
