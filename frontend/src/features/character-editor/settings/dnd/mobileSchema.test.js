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

  it('shows actions and expanded feature cards on the mobile abilities tab', () => {
    const abilities = schema.layouts.mobile.tabs.find(tab => tab.title === 'Способности')
    const [featureWidgets, actions, resources, defenses, proficiencies, ...features] = abilities?.content?.children || []

    expect(featureWidgets?.ref).toBe('feature_widgets')
    expect(actions?.ref).toBe('actions')
    expect([resources?.ref, defenses?.ref, proficiencies?.ref]).toEqual(['resources', 'defenses', 'proficiencies'])
    expect(schema.blocks.passive_effects).toBeUndefined()
    expect(features.map(block => block.ref)).toEqual([
      'abilities_class',
      'abilities_race',
      'abilities_feats',
    ])
    expect(features.every(block => block.content?.expanded === true)).toBe(true)
    expect(schema.blocks.actions.type).toBe('DND_ACTIONS')
  })

  it('keeps HP content-sized and groups the remaining mobile status actions', () => {
    const summary = schema.layouts.mobile.common_mobile_blocks
    const hp = summary.children.find(block => block.ref === 'hp')
    const statuses = summary.children.find(block => block.ref === 'mobile_statuses')

    expect(summary.children.map(block => block.ref)).toEqual(['hp', 'mobile_statuses'])
    expect(hp.props).toEqual({ variant: 'compact' })
    expect(statuses.props).toMatchObject({
      grow: 1,
      basis: 0,
      'min-width': '0',
    })
    expect(schema.blocks.mobile_statuses.content).toEqual({
      states_id: 'states',
      states_suggest_id: 9,
      exhaustion_id: 'exhaustion',
      inspiration_id: 'inspiration',
    })
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
