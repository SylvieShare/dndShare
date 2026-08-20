import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const tile = readFileSync(fileURLToPath(new URL('./SpellSelectTile.vue', import.meta.url)), 'utf8')
const step = readFileSync(fileURLToPath(new URL('./steps/StepSpells.vue', import.meta.url)), 'utf8')

describe('spell selection tile', () => {
  it('shows handbook artwork with a thematic fallback and compact spell facts', () => {
    expect(tile).toContain('<ItemIcon v-if="spell.iconImageUrl || spell.svg"')
    expect(tile).toContain('<Sparkles v-else')
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
})
