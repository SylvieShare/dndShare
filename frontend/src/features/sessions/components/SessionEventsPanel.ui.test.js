import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./SessionEventsPanel.vue', import.meta.url)), 'utf8')

describe('SessionEventsPanel timeline layout', () => {
  it('wraps content instead of exposing horizontal scrolling', () => {
    expect(source).toMatch(/\.sep-list\s*\{[^}]*overflow-x:\s*hidden;/s)
    expect(source).toMatch(/\.sep-roll\s*\{[^}]*flex-wrap:\s*wrap;/s)
    expect(source).toMatch(/\.sep-actor-head\s*\{[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/s)
  })

  it('draws the connector through markers without lines outside the group', () => {
    expect(source).toContain('.sep-event::before, .sep-event::after')
    expect(source).toContain('.sep-event:first-child::before, .sep-event:last-child::after { display: none; }')
    expect(source).not.toMatch(/\.sep-actor-events\s*\{[^}]*border-left:/s)
  })

  it('uses transparent framed event cards', () => {
    expect(source).toMatch(/\.sep-content\s*\{[^}]*border:\s*1px solid[^}]*background:\s*transparent;/s)
  })
})
