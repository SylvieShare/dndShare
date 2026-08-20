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
    expect(initiativeStyles).toContain('aspect-ratio: 4 / 3;')
  })

  it('renders NPC artwork without a frame or backing surface', () => {
    expect(pageSource).toContain("'turn-spotlight__art--npc': currentCombatant.type === 'npc'")
    expect(pageSource).toContain("'initiative-card__portrait--npc': combatant.type === 'npc'")
    expect(initiativeStyles).toContain('.turn-spotlight__art--npc img')
    expect(initiativeStyles).toContain('.initiative-card__portrait--npc {')
    expect(initiativeStyles).toContain('background: transparent;')
  })

  it('keeps emphasized colored creature letters by active names and on queue portrait corners', () => {
    expect(pageSource).toContain('class="creature-marker"')
    expect(pageSource).toContain('class="initiative-card__corner-marker"')
    expect(pageSource).not.toContain('<strong>{{ combatant.name }}</strong>')
    expect(initiativeStyles).toContain('.creature-marker {')
    expect(initiativeStyles).toContain('transform: translate(50%, -50%);')
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

  it('places the compact full-width queue above the active card without cropping icons', () => {
    expect(initiativeStyles).toContain('grid-template-columns: minmax(0, 1fr);')
    expect(initiativeStyles).toContain('grid-row: 1;')
    expect(initiativeStyles).toContain('grid-row: 2;')
    expect(initiativeStyles).toContain('.initiative-card__portrait img {')
    expect(initiativeStyles).toContain('object-fit: contain;')
    expect(initiativeStyles).toContain('flex-direction: column;')
    expect(initiativeStyles).toContain('width: calc(var(--queue-portrait-size) + var(--queue-card-padding) + var(--queue-card-padding));')
    expect(pageSource).toContain('class="encounter-health initiative-card__health"')
    expect(pageSource).toContain('if (viewportWidth.value >= 1800) return 6')
  })

  it('uses a flat canvas and no combatant color strip', () => {
    expect(mainStyles).toContain('background-color: var(--app-canvas-bg);')
    expect(mainStyles).toContain('background-image: var(--app-canvas-pattern);')
    expect(mainStyles).toContain('background-size: var(--app-canvas-dot-size) var(--app-canvas-dot-size);')
    expect(mainStyles).not.toContain('.encounter-screen::before')
    expect(mainStyles).not.toContain('.encounter-screen__glow')
    expect(initiativeStyles).not.toContain('.initiative-card::after')
  })

  it('supports optional numeric or worded health, graveyard and public timers without initiative', () => {
    expect(pageSource).toContain('presentation.showHealth')
    expect(pageSource).toContain("presentation.value?.healthDisplay === 'numbers'")
    expect(pageSource).toContain("combatant?.health?.label || 'Неизвестно'")
    expect(pageSource).not.toContain('presentation.showInitiative')
    expect(pageSource).not.toContain('Инициатива')
    expect(pageSource).toContain('presentation.showGraveyard')
    expect(pageSource).toContain('class="encounter-graveyard"')
    expect(pageSource).toContain('class="broadcast-timers"')
    expect(mainStyles).toContain('.broadcast-timer')
  })
})
