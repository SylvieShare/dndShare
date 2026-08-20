import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const tile = readFileSync(fileURLToPath(new URL('./SpellSelectTile.vue', import.meta.url)), 'utf8')
const step = readFileSync(fileURLToPath(new URL('./steps/StepSpells.vue', import.meta.url)), 'utf8')

describe('spell selection tile', () => {
  it('shows handbook artwork with a thematic fallback and compact spell facts', () => {
    expect(tile).toContain('<ItemIcon v-if="spell.iconImageUrl || spell.svg"')
    expect(tile).toContain('<Sparkles v-else')
    expect(tile).toContain(':size="46"')
    expect(tile).not.toContain('spell-tile-icon { width: 48px; height: 48px; flex: none; display: grid; place-items: center; border-radius')
    expect(tile).toContain("data.value.time")
    expect(tile).toContain("data.value.range")
    expect(tile).toContain('props.school')
  })

  it('keeps selection and handbook details as separate actions', () => {
    expect(tile).toContain('@click="$emit(\'select\')"')
    expect(tile).toContain('@click.stop="$emit(\'details\')"')
    expect(step).toContain('<SpellSelectTile')
    expect(step).toContain('@details="viewId = sp.id"')
    expect(step).toContain('readonly')
  })

  it('keeps the details action circular and limits the desktop grid to three tiles', () => {
    expect(tile).toContain('width: 32px; height: 32px; aspect-ratio: 1;')
    expect(step).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))')
    expect(step).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
  })
})
