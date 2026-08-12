import { describe, expect, it } from 'vitest'
import schema from './schema'

function findNode(node, predicate) {
  if (!node) return null
  if (predicate(node)) return node
  for (const child of node.children || []) {
    const match = findNode(child, predicate)
    if (match) return match
  }
  return null
}

describe('D&D desktop sheet schema', () => {
  const base = schema.layouts.desktop.tabs.find(tab => tab.title === 'База')
  const innerTabs = findNode(base?.content, node => node.type === 'inner_tabs')

  it('groups equipment and personality with shared divider headings', () => {
    const equipment = innerTabs.children.find(tab => tab.title === 'Снаряжение')
    const personality = innerTabs.children.find(tab => tab.title === 'Личность')

    expect(equipment.content.children.map(group => group.props?.title)).toEqual([
      'Ресурсы',
      'Зелья',
      'Инвентарь',
    ])
    expect(equipment.content.children.every(group => group.props?.title_variant === 'divider')).toBe(true)

    const personalityGroups = personality.content.children[0].children
    expect(personalityGroups.map(group => group.props?.title)).toEqual([
      'Основное',
      'Облик',
      'Характер',
      'История',
    ])
    expect(personalityGroups.every(group => group.props?.title_variant === 'divider')).toBe(true)
  })

  it('uses the same divider heading variant for diary sections', () => {
    const diary = innerTabs.children.find(tab => tab.title === 'Дневник')

    expect(diary.content.children.map(block => block.ref)).toEqual(['quests', 'diary', 'notes'])
    expect(diary.content.children.every(block => block.props?.title_variant === 'divider')).toBe(true)
  })
})
