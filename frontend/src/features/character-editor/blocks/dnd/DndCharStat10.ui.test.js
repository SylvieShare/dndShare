import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./DndCharStat10.vue', import.meta.url)), 'utf8')

describe('DndCharStat10 rolls', () => {
  it('passes the characteristic color to checks, saves, and skill rolls', () => {
    expect(source).toContain('diceStore.rollD20(title, bonus, mode, {')
    expect(source.match(/rollD20Plus\(/g)).toHaveLength(7)
  })

  it('builds the skill tooltip bonus breakdown from every bonus source', () => {
    expect(source).toContain('bonusDetails: skillBonusDetails(s.id)')
    expect(source).toContain("label: rank >= 2 ? 'Мастерство' : 'Владение'")
    expect(source).toContain("label: label || 'Дополнительный бонус'")
    expect(source).toContain("`Источники: ${sources.join(' · ')}`")
  })
})
