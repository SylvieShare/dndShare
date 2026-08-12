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

  it('uses independent surfaces for weapons, equipment and personality groups', () => {
    const weapons = innerTabs.children.find(tab => tab.title === 'Оружие')
    const equipment = innerTabs.children.find(tab => tab.title === 'Снаряжение')
    const personality = innerTabs.children.find(tab => tab.title === 'Личность')

    expect(weapons.content.props?.tile).toBe(true)
    expect(equipment.content.children.every(group => group.props?.tile === true)).toBe(true)
    expect(equipment.content.children.every(group => group.props?.title == null)).toBe(true)

    const personalityGroups = personality.content.children[0].children
    expect(personalityGroups.every(group => group.props?.tile === true)).toBe(true)
    expect(personalityGroups.every(group => group.props?.title == null)).toBe(true)
  })

  it('keeps diary collections independent and gives notes their own surface', () => {
    const diary = innerTabs.children.find(tab => tab.title === 'Дневник')

    expect(diary.content.children[0].ref).toBe('quests')
    expect(diary.content.children[1].ref).toBe('diary')
    expect(diary.content.children[2].props?.tile).toBe(true)
    expect(diary.content.children[2].children?.[0]?.ref).toBe('notes')
  })
})
