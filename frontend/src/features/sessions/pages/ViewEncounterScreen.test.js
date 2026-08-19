import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(fileURLToPath(new URL('./ViewEncounterScreen.vue', import.meta.url)), 'utf8')
const mainStyles = readFileSync(fileURLToPath(new URL('./styles/ViewEncounterScreen.css', import.meta.url)), 'utf8')
const initiativeStyles = readFileSync(fileURLToPath(new URL('./styles/ViewEncounterScreenInitiative.css', import.meta.url)), 'utf8')

describe('public encounter portraits', () => {
  it('fills the right edge of the current-turn panel with the creature cover', () => {
    expect(pageSource).toContain("'encounter-screen__turn-portrait--cover': currentCombatant.coverImageUrl")
    expect(pageSource).toContain('<img v-if="currentCombatant.coverImageUrl" :src="currentCombatant.coverImageUrl" alt="" />')
    expect(mainStyles).toContain('.encounter-screen__turn-portrait--cover {')
    expect(mainStyles).toContain('align-self: stretch;')
    expect(mainStyles).toContain('margin-right: 0;')
  })

  it('renders NPC artwork without a frame or backing surface', () => {
    expect(pageSource).toContain("'encounter-screen__turn-portrait--npc': currentCombatant.type === 'npc'")
    expect(pageSource).toContain("'initiative-card__portrait--npc': combatant.type === 'npc'")
    expect(mainStyles).toContain('.encounter-screen__turn-portrait--npc {')
    expect(initiativeStyles).toContain('.initiative-card__portrait--npc {')
    expect(initiativeStyles).toContain('background: transparent;')
  })

  it('does not stretch the NPC letter marker over its artwork', () => {
    expect(mainStyles).toContain('.initiative-card__portrait > span:not(.initiative-card__marker)')
    expect(initiativeStyles).toContain('.initiative-card__portrait > span:not(.initiative-card__marker)')
  })
})

describe('public encounter composition', () => {
  it('places initiative before the current-turn spotlight', () => {
    expect(pageSource.indexOf('class="encounter-screen__initiative"'))
      .toBeLessThan(pageSource.indexOf('class="encounter-screen__turn"'))
  })

  it('uses a flat canvas and no combatant color strip', () => {
    expect(mainStyles).toContain('background-color: var(--app-canvas-bg);')
    expect(mainStyles).toContain('background-image: var(--app-canvas-pattern);')
    expect(mainStyles).toContain('background-size: var(--app-canvas-dot-size) var(--app-canvas-dot-size);')
    expect(mainStyles).not.toContain('.encounter-screen::before')
    expect(mainStyles).not.toContain('.encounter-screen__glow')
    expect(initiativeStyles).not.toContain('.initiative-card::after')
  })
})
