import { describe, expect, it } from 'vitest'
import { dialogueKeySuggestions, hydrateDialogueRows, pickDialogueColor } from './dialogueRows'

describe('dialogue rows', () => {
  it('keeps one color per participant and gives different participants distinct colors', () => {
    const rows = hydrateDialogueRows([
      { left: 'Мира', right: 'Привет' },
      { left: 'Торв', right: 'И тебе' },
      { left: ' мира ', right: 'Идём?' },
    ])
    expect(rows[0].color).toBe(rows[2].color)
    expect(rows[0].color).not.toBe(rows[1].color)
  })

  it('offers unique entered names and reuses their colors during autocomplete', () => {
    const rows = hydrateDialogueRows([{ left: 'Мира' }, { left: 'Торв' }])
    const active = { left: 'мира', color: '' }
    rows.push(active)
    expect(dialogueKeySuggestions(rows)).toEqual(['Мира', 'Торв'])
    expect(pickDialogueColor(rows, active)).toBe(rows[0].color)
  })

  it('takes an unused pool color for a newly entered participant', () => {
    const rows = hydrateDialogueRows([{ left: 'Мира' }])
    const active = { left: 'Торв', color: '' }
    rows.push(active)
    expect(pickDialogueColor(rows, active, () => 0)).not.toBe(rows[0].color)
  })
})
