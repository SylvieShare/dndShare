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

  it('keeps an explicit right gutter around the central tab column', () => {
    const tabColumn = findNode(
      base?.content,
      node => node.children?.some(child => child.type === 'inner_tabs'),
    )

    expect(tabColumn.props?.style?.['margin-right']).toBe('16px')
  })

  it('lets weapon entries and inventory sections own their surfaces', () => {
    const weapons = innerTabs.children.find(tab => tab.title === 'Оружие')
    const equipment = innerTabs.children.find(tab => tab.title === 'Снаряжение')
    const personality = innerTabs.children.find(tab => tab.title === 'Личность')

    expect(weapons.content.ref).toBe('weapon')
    expect(weapons.content.props?.variant).toBe('list')

    const inventoryGroup = equipment.content.children.find(group =>
      group.children?.some(child => child.ref === 'items'),
    )
    const fixedEquipmentGroups = equipment.content.children.filter(group => group !== inventoryGroup)

    expect(inventoryGroup.props?.tile).not.toBe(true)
    expect(fixedEquipmentGroups.every(group => group.props?.tile === true)).toBe(true)
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

  it('groups conditions, exhaustion and inspiration in one desktop status block', () => {
    const statuses = findNode(base?.content, node => node.ref === 'desktop_statuses')
    const separateExhaustion = findNode(base?.content, node => node.ref === 'exhaustion')
    const separateStates = findNode(base?.content, node => node.ref === 'states')

    expect(statuses).toBeTruthy()
    expect(separateExhaustion).toBeNull()
    expect(separateStates).toBeNull()
    expect(schema.blocks.desktop_statuses).toMatchObject({
      type: 'DND_STATUS_OVERVIEW',
      content: {
        states_id: 'states',
        states_suggest_id: 9,
        exhaustion_id: 'exhaustion',
        inspiration_id: 'inspiration',
      },
    })
  })

  it('keeps derived defenses beside the character resources', () => {
    const resources = findNode(base?.content, node => node.ref === 'resources')
    const defenses = findNode(base?.content, node => node.ref === 'defenses')

    expect(resources).toBeTruthy()
    expect(defenses).toBeTruthy()
    expect(schema.blocks.defenses).toMatchObject({
      type: 'DND_DEFENSES',
      content: { damage_type_suggest_id: 12 },
    })
  })

  it('groups feats and race/class abilities in one visual tile', () => {
    const features = findNode(
      base?.content,
      node => node.children?.map(child => child.ref).join(',') === 'abilities_feats,abilities_race,abilities_class',
    )

    expect(features?.props?.tile).toBe(true)
    expect(features?.children?.map(block => block.content)).toEqual([
      { embedded: true },
      { embedded: true, divider: true },
      { embedded: true, divider: true },
    ])
  })
})
