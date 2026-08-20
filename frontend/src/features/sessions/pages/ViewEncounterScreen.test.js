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
    expect(initiativeStyles).toContain('.creature-marker,\n.initiative-card__corner-marker {')
    expect(initiativeStyles).toContain('background: color-mix(in srgb, var(--screen-combatant-color) 78%, var(--surface));')
    expect(initiativeStyles).toContain('color: var(--text-on-accent);')
    expect(initiativeStyles).toContain('top: 3px;')
    expect(initiativeStyles).toContain('right: 3px;')
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

  it('places a tightly packed square queue above the larger active card without cropping icons', () => {
    expect(initiativeStyles).toContain('grid-template-columns: minmax(0, 1fr) auto;')
    expect(initiativeStyles).toContain('grid-row: 1;')
    expect(initiativeStyles).toContain('grid-row: 2;')
    expect(initiativeStyles).toContain('width: clamp(360px, 46vw, 700px);')
    expect(initiativeStyles).toContain('.initiative-card__portrait img {')
    expect(initiativeStyles).toContain('object-fit: contain;')
    expect(initiativeStyles).toContain('flex-direction: column;')
    expect(initiativeStyles).toContain('grid-template-columns: repeat(var(--queue-slots, 6), var(--queue-card-size));')
    expect(initiativeStyles).toContain('justify-content: start;')
    expect(initiativeStyles).toContain('aspect-ratio: 1;')
    expect(initiativeStyles).toContain('translate: calc(var(--queue-stack-offset) * 18px) calc(var(--queue-stack-offset) * -24px);')
    expect(initiativeStyles).toContain('.initiative-track--overflow { padding-right: 82px; }')
    expect(pageSource).toContain('class="encounter-health initiative-card__health"')
    expect(pageSource).toContain(`:style="{ '--queue-slots': queueSlotCount }"`)
    expect(pageSource).toContain("'initiative-track--overflow': queueStackCount > 1")
    expect(pageSource).toContain('const stackReserve = turnQueue.value.length > baseSlots ? 82 : 10')
    expect(pageSource).toContain('Math.floor((availableWidth + gap) / (cardSize + gap))')
    expect(pageSource).toContain('class="initiative-direction"')
    expect(pageSource).toContain('<span>Следующий</span>')
    expect(pageSource).toContain('<span>Позже</span>')
    expect(initiativeStyles).toContain('.initiative-direction i::after {')
    expect(initiativeStyles).toContain('rotate(45deg)')
  })

  it('keeps the current round in the queue heading instead of a floating status pill', () => {
    expect(pageSource).toContain('class="encounter-queue__summary"')
    expect(pageSource).toContain('<span>Раунд</span><strong>{{ snapshot.round }}</strong>')
    expect(pageSource).not.toContain("pollFailed || (presentation?.mode === 'combat' && snapshot?.active)")
    expect(initiativeStyles).toContain('.encounter-queue__summary .encounter-screen__round')
  })

  it('stacks graveyard rows upward on the right in name, icon and count order', () => {
    const nameIndex = pageSource.indexOf('<strong>{{ group.name }}</strong>')
    const portraitIndex = pageSource.indexOf('class="graveyard-card__portrait"')
    const countIndex = pageSource.indexOf('<b>×{{ group.count }}</b>')
    expect(nameIndex).toBeLessThan(portraitIndex)
    expect(portraitIndex).toBeLessThan(countIndex)
    expect(initiativeStyles).toContain('.encounter-graveyard {')
    expect(initiativeStyles).toContain('flex-direction: column-reverse;')
    expect(initiativeStyles).toContain('grid-column: 2;')
    expect(initiativeStyles).toContain('grid-template-columns: minmax(0, 1fr) 48px auto;')
    expect(initiativeStyles).toContain('padding: 5px 0;')
    expect(initiativeStyles).toContain('background: transparent;')
    expect(initiativeStyles).toContain('text-align: right;')
    expect(initiativeStyles).toContain('.graveyard-card__portrait { width: 48px;')
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
