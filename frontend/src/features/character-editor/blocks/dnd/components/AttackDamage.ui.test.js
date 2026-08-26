import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./AttackDamage.vue', import.meta.url)), 'utf8')

describe('attack damage roll menu', () => {
  it('opens normal and critical actions from the damage dice block', () => {
    expect(source).toContain('v-if="hasDamage && rollable && damageMenu"')
    expect(source).toContain('>Обычный урон</RowActionItem>')
    expect(source).toContain('>Критический урон</RowActionItem>')
    expect(source).not.toContain('class="ad-crit')
  })
})
