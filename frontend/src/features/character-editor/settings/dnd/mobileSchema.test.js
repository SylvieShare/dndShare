import { describe, expect, it } from 'vitest'
import schema from './schema'

describe('D&D mobile sheet schema', () => {
  it('keeps the mobile diary equivalent to the desktop diary section', () => {
    const diary = schema.layouts.mobile.tabs.find(tab => tab.title === 'Дневник')

    expect(diary?.svg).toBe('/static/edit-note.svg')
    expect(diary?.content?.children?.map(block => block.ref)).toEqual(['quests', 'diary', 'notes'])
  })

  it('shows exhaustion in the compact mobile summary', () => {
    const summary = schema.layouts.mobile.common_mobile_blocks
    const exhaustion = summary.children.find(block => block.ref === 'exhaustion')

    expect(summary.children.map(block => block.ref)).toEqual(['hp', 'exhaustion', 'states'])
    expect(exhaustion.props.variant).toBe('compact')
  })
})
