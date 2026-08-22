import { describe, expect, it } from 'vitest'

import {
  actionableItemChoices,
  choiceSelectionsComplete,
  choicesForEntry,
  itemChoiceRows,
  itemChoices,
  itemMatchesChoiceFilter,
} from './itemChoices'

describe('handbook item choices', () => {
  it('normalizes the shared choices array', () => {
    const item = { data: { choices: [{ key: 'element', count: 2, from_suggest_id: 12 }] } }

    expect(itemChoices(item)).toEqual([expect.objectContaining({
      key: 'element',
      count: 2,
      source: 'suggest',
      options: [],
    })])
    expect(choiceSelectionsComplete(item, { element: [4, 5] })).toBe(true)
  })

  it('adapts the legacy singular ability choice', () => {
    const item = { data: { choice: { text: 'Стиль', options: [{ label: 'Защита' }] } } }

    expect(itemChoices(item)).toEqual([expect.objectContaining({
      key: 'choice',
      count: 1,
      source: 'inline',
      options: [{ label: 'Защита' }],
    })])
    expect(choiceSelectionsComplete(item, { choice: ['Защита'] })).toBe(true)
  })

  it('prefers the canonical array when both formats exist', () => {
    const item = { data: {
      choices: [{ key: 'canonical', options: [{ value: 'yes' }] }],
      choice: { text: 'old', options: [{ label: 'no' }] },
    } }

    expect(itemChoices(item).map((choice) => choice.key)).toEqual(['canonical'])
  })

  it('gives multiple choices stable independent selection keys', () => {
    const item = { id: 42, name: 'Универсальность', data: { choices: [
      { key: 'skill', from_suggest_id: 15 },
      { key: 'language', from_suggest_id: 6 },
    ] } }

    expect(itemChoiceRows(item).map((row) => row.id)).toEqual(['42:skill', '42:language'])
    expect(choicesForEntry(item, { '42:skill': [2], '42:language': [6] })).toEqual({
      skill: [2],
      language: [6],
    })
  })

  it('ignores incomplete choice definitions in mandatory UI flows', () => {
    const item = { data: { choices: [{ key: 'empty' }, { key: 'ready', options: [{ label: 'Да' }] }] } }

    expect(actionableItemChoices(item).map((choice) => choice.key)).toEqual(['ready'])
  })

  it('matches scalar fields and paths through object arrays', () => {
    const spell = { data: { lvl: 0, classes: [{ id: 4014 }, { id: 4017 }] } }
    expect(itemMatchesChoiceFilter(spell, '{"lvl":0,"classes.id":4014}')).toBe(true)
    expect(itemMatchesChoiceFilter(spell, '{"lvl":1,"classes.id":4014}')).toBe(false)
  })
})
