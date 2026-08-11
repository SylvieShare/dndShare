import { describe, expect, it } from 'vitest'
import schema from './schema'

describe('D&D mobile sheet schema', () => {
  it('composes rich mobile tabs from separate content blocks', () => {
    expect(schema.layouts.mobile.tabs.filter(tab => tab.surface)).toEqual([])

    const personality = schema.layouts.mobile.tabs.find(tab => tab.title === 'Личность')
    const groups = personality?.content?.children || []

    expect(groups.every(group => group.props?.tile === true)).toBe(true)
    expect(groups.map(group => group.children?.[0]?.title)).toEqual([
      'Основное',
      'Облик',
      'Характер',
      'История',
    ])

    const identityFields = groups[0]?.children?.[1]
    expect(identityFields?.type).toBe('column')
    expect(identityFields?.children?.map(block => block.ref)).toEqual([
      'person_origin',
      'person_alignment',
    ])
  })

  it('keeps the mobile diary equivalent to the desktop diary section', () => {
    const diary = schema.layouts.mobile.tabs.find(tab => tab.title === 'Дневник')

    expect(diary?.svg).toBe('/static/edit-note.svg')
    expect(diary?.content?.children?.map(block => block.ref)).toEqual(['quests', 'diary', 'notes'])
  })

  it('shows exhaustion in the compact mobile summary', () => {
    const summary = schema.layouts.mobile.common_mobile_blocks
    const hp = summary.children.find(block => block.ref === 'hp')
    const exhaustion = summary.children.find(block => block.ref === 'exhaustion')

    expect(summary.children.map(block => block.ref)).toEqual(['hp', 'exhaustion', 'states'])
    expect(hp.props['min-width']).toBe('100px')
    expect(exhaustion.props.variant).toBe('compact')
    expect(exhaustion.props).toMatchObject({ shrink: 0, basis: '58px', 'min-width': '58px' })
  })

  it('keeps identity editing out of the mobile personality tab', () => {
    const personality = schema.layouts.mobile.tabs.find(tab => tab.title === 'Личность')
    const refs = []
    const collectRefs = block => {
      if (block.ref) refs.push(block.ref)
      block.children?.forEach(collectRefs)
    }

    collectRefs(personality?.content)

    for (const identityRef of ['ava', 'name', 'race', 'class']) {
      expect(refs).not.toContain(identityRef)
    }
    expect(refs).toEqual(expect.arrayContaining([
      'person_origin',
      'person_alignment',
      'person_appearance',
      'person_traits',
      'person_backstory',
      'person_allies',
    ]))
  })
})
