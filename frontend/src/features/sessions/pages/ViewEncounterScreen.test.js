import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(fileURLToPath(new URL('./ViewEncounterScreen.vue', import.meta.url)), 'utf8')
const mainStyles = readFileSync(fileURLToPath(new URL('./styles/ViewEncounterScreen.css', import.meta.url)), 'utf8')
const initiativeStyles = readFileSync(fileURLToPath(new URL('./styles/ViewEncounterScreenInitiative.css', import.meta.url)), 'utf8')

describe('public encounter portraits', () => {
  it('uses the creature cover as the full active-turn artwork', () => {
    expect(pageSource).toContain('class="turn-spotlight__art"')
    expect(pageSource).toContain(':src="currentCombatant.coverImageUrl || currentCombatant.avatarUrl"')
    expect(initiativeStyles).toContain('.turn-spotlight__art {')
    expect(initiativeStyles).toContain('position: absolute;')
    expect(initiativeStyles).toContain('.turn-spotlight__art img { object-fit: cover; }')
    expect(initiativeStyles).toContain('backdrop-filter: blur(8px)')
  })

  it('renders NPC artwork without a frame or backing surface', () => {
    expect(pageSource).toContain("'turn-spotlight__art--npc': currentCombatant.type === 'npc'")
    expect(pageSource).toContain("'initiative-card__portrait--npc': combatant.type === 'npc'")
    expect(initiativeStyles).toContain('.turn-spotlight__art--npc img')
    expect(initiativeStyles).toContain('.initiative-card__portrait--npc {')
    expect(initiativeStyles).toContain('background: transparent;')
  })

  it('places emphasized colored creature letters before names', () => {
    expect(pageSource).toContain('class="creature-marker"')
    expect(pageSource).toContain('<strong>{{ combatant.name }}</strong>')
    expect(initiativeStyles).toContain('.creature-marker {')
    expect(initiativeStyles).toContain('var(--screen-combatant-color)')
  })
})

describe('public encounter composition', () => {
  it('keeps the active turn left and a cyclic stacked queue right', () => {
    expect(pageSource.indexOf('class="turn-spotlight"'))
      .toBeLessThan(pageSource.indexOf('class="encounter-combat-side"'))
    expect(pageSource).toContain('...combatants.value.slice(currentIndex.value + 1)')
    expect(pageSource).toContain('...combatants.value.slice(0, currentIndex.value)')
    expect(pageSource).toContain('mode="out-in"')
    expect(initiativeStyles).toContain('.turn-spotlight-leave-to')
    expect(initiativeStyles).toContain('translateX(-115%)')
    expect(initiativeStyles).toContain('.initiative-card--stacked')
  })

  it('uses a flat canvas and no combatant color strip', () => {
    expect(mainStyles).toContain('background-color: var(--app-canvas-bg);')
    expect(mainStyles).toContain('background-image: var(--app-canvas-pattern);')
    expect(mainStyles).toContain('background-size: var(--app-canvas-dot-size) var(--app-canvas-dot-size);')
    expect(mainStyles).not.toContain('.encounter-screen::before')
    expect(mainStyles).not.toContain('.encounter-screen__glow')
    expect(initiativeStyles).not.toContain('.initiative-card::after')
  })

  it('supports optional numeric health, initiative, graveyard and public timers', () => {
    expect(pageSource).toContain('presentation.showHealth')
    expect(pageSource).toContain('presentation.showInitiative')
    expect(pageSource).toContain('presentation.showGraveyard')
    expect(pageSource).toContain('class="encounter-graveyard"')
    expect(pageSource).toContain('class="broadcast-timers"')
    expect(mainStyles).toContain('.broadcast-timer')
  })
})
