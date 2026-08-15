import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./SessionEventsPanel.vue', import.meta.url)), 'utf8')

describe('SessionEventsPanel timeline layout', () => {
  it('leaves its visibility to the persistent session dock control', () => {
    expect(source).not.toContain('sep-collapse')
    expect(source).not.toContain('defineEmits')
    expect(source).not.toContain('collapsed')
  })

  it('wraps content instead of exposing horizontal scrolling', () => {
    expect(source).toMatch(/\.sep-list\s*\{[^}]*overflow-x:\s*hidden;/s)
    expect(source).toMatch(/\.sep-roll\s*\{[^}]*flex-wrap:\s*wrap;/s)
    expect(source).toMatch(/\.sep-actor-head\s*\{[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/s)
  })

  it('draws connector segments only between markers', () => {
    expect(source).toMatch(/\.sep-event::after\s*\{[^}]*top:\s*18px;[^}]*bottom:\s*0;/s)
    expect(source).toContain('.sep-event:last-child::after { display: none; }')
    expect(source).not.toContain('.sep-event::before')
    expect(source).not.toMatch(/\.sep-actor-events\s*\{[^}]*border-left:/s)
  })

  it('frames transparent event markers and leaves event content unframed', () => {
    expect(source).toMatch(/\.sep-marker\s*\{[^}]*border:\s*1px solid[^}]*background:\s*transparent;/s)
    expect(source).toMatch(/\.sep-content\s*\{[^}]*background:\s*transparent;/s)
    expect(source).not.toMatch(/\.sep-content\s*\{[^}]*border:/s)
  })

  it('places the dice total in the event heading with a divider', () => {
    expect(source).toContain("'sep-event-heading--roll': event.type === 'dice_roll'")
    expect(source).toContain('class="sep-event-divider"')
    expect(source).toMatch(/<strong v-if="event\.type === 'dice_roll'" class="sep-total">/)
    expect(source).toMatch(/\.sep-event-divider\s*\{[^}]*flex:\s*1 1 12px;[^}]*height:\s*1px;/s)
    expect(source).not.toMatch(/<div v-if="event\.type === 'dice_roll'" class="sep-roll">[\s\S]*?<strong class="sep-total">/)
  })
})
