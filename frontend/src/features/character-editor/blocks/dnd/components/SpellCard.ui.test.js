import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./SpellCard.vue', import.meta.url)), 'utf8')

describe('character spell card icon', () => {
  it('shows a raster item icon when the spell has one', () => {
    expect(source).toContain('v-if="entry.item?.iconImageUrl"')
    expect(source).toContain('<ItemIcon')
    expect(source).toContain(':fallback-to-type="false"')
    expect(source).toContain(':size="64"')
  })

  it('keeps the current school symbol as the fallback', () => {
    expect(source).toContain('v-else-if="school"')
    expect(source).toContain('class="sp-school"')
    expect(source).toContain('v-if="school.svg"')
  })

  it('opens semantic actions and moves deletion into the menu', () => {
    expect(source).toContain('<RowActionMenu')
    expect(source).toContain('<RowActionSubmenu')
    expect(source).toContain('ctx.useSpell(props.entry, option)')
    expect(source).toContain("option.pool === 'short_rest'")
    expect(source).toContain('Выберите ячейку')
    expect(source).not.toContain('choosingSlot')
    expect(source).toContain('action="delete"')
    expect(source).not.toContain('class="sp-del"')
  })

  it('moves both preparation statuses into actions and decorates leveled spells', () => {
    expect(source).not.toContain('class="sp-prepared"')
    expect(source).toContain('v-if="ctx.charCtx.ownerMode && canPrepare && !isAlwaysPrepared"')
    expect(source).toContain('baseLvl.value > 0')
    expect(source).toContain('ctx.togglePrepared(props.entry.ref.id)')
    expect(source).toContain('ctx.toggleAlwaysPrepared(props.entry.ref.id)')
    expect(source).toContain(':permanent="isAlwaysPrepared"')
  })

  it('uses a dice menu for normal and critical damage without a cast-level stepper', () => {
    expect(source).toContain('damage-menu')
    expect(source).toContain('@roll-critical="ctx.rollSpellDamage(entry, castLevel, true)"')
    expect(source).not.toContain('class="sp-step"')
    expect(source).not.toContain('classSourceSummary')
    expect(source).not.toContain('Заклинательная характеристика:')
    expect(source).not.toContain('Даровано особенностью')
  })
})
