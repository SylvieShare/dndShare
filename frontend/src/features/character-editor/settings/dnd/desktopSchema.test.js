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

  it('separates equipment and personality groups without extra headings', () => {
    const equipment = innerTabs.children.find(tab => tab.title === 'Снаряжение')
    const personality = innerTabs.children.find(tab => tab.title === 'Личность')

    expect(equipment.content.children.map(group => !!group.props?.divider_before)).toEqual([
      false,
      true,
      true,
    ])
    expect(equipment.content.children.every(group => group.props?.title == null)).toBe(true)

    const personalityGroups = personality.content.children[0].children
    expect(personalityGroups.map(group => !!group.props?.divider_before)).toEqual([
      false,
      true,
      true,
      true,
    ])
    expect(personalityGroups.every(group => group.props?.title == null)).toBe(true)
  })

  it('places decorative dividers only before later diary sections', () => {
    const diary = innerTabs.children.find(tab => tab.title === 'Дневник')

    expect(diary.content.children.map(block => block.ref)).toEqual(['quests', 'diary', 'notes'])
    expect(diary.content.children.map(block => !!block.props?.divider_before)).toEqual([
      false,
      true,
      true,
    ])
  })
})
