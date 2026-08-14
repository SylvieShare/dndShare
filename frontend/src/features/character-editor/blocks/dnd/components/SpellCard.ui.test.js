import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./SpellCard.vue', import.meta.url)), 'utf8')

describe('character spell card icon', () => {
  it('shows a raster item icon when the spell has one', () => {
    expect(source).toContain('v-if="entry.item?.iconImageUrl"')
    expect(source).toContain('<ItemIcon')
    expect(source).toContain(':fallback-to-type="false"')
    expect(source).toContain(':size="48"')
  })

  it('keeps the current school symbol as the fallback', () => {
    expect(source).toContain('v-else-if="school"')
    expect(source).toContain('class="sp-school"')
    expect(source).toContain('v-if="school.svg"')
  })

  it('opens semantic actions and moves deletion into the menu', () => {
    expect(source).toContain('<RowActionMenu')
    expect(source).toContain("ctx.useSpell(props.entry, level)")
    expect(source).toContain('Выберите ячейку')
    expect(source).toContain('action="delete"')
    expect(source).not.toContain('class="sp-del"')
  })
})
