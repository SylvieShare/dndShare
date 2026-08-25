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

  it('uses one desktop row with stats, main content and utility columns', () => {
    const [statsColumn, mainColumn, utilityColumn] = base.content.children

    expect(statsColumn.children.map(child => child.ref)).toEqual(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'])
    expect(findNode(mainColumn, node => node.ref === 'character_icon')).toBeTruthy()
    expect(findNode(mainColumn, node => node.ref === 'desktop_statuses')).toBeTruthy()
    expect(findNode(mainColumn, node => node.type === 'inner_tabs')).toBeTruthy()
    expect(findNode(utilityColumn, node => node.ref === 'lvl')).toBeTruthy()
    expect(statsColumn.props?.style?.padding).toBe('20px')
    expect(utilityColumn.props?.style?.padding).toBe('20px')
    expect(utilityColumn.props?.style?.['margin-right']).toBeUndefined()
    expect(utilityColumn.props?.width).toBe('360px')
    expect(utilityColumn.children.slice(1).map(child => child.ref)).toEqual([
      'feature_widgets', 'actions', 'resources', 'defenses', 'proficiencies',
    ])
  })

  it('places level below speed, proficiency bonus and rests across all three metric columns', () => {
    const metricGrid = findNode(
      base?.content,
      node => node.type === 'grid' && node.children?.some(child => child.ref === 'rest'),
    )
    const level = findNode(base?.content, node => node.ref === 'lvl')
    const levelRow = metricGrid.children.at(-1)

    expect(metricGrid.props?.width).toBe('320px')
    expect(metricGrid.props?.style?.['grid-auto-rows']).toBe('64px')
    expect(metricGrid.children.slice(0, -1).map(child => child.ref)).toEqual([
      'armor', 'initiative', 'settings',
      'speed', 'prof_bonus', 'rest',
    ])
    expect(levelRow).toMatchObject({
      kind: 'layout',
      type: 'row',
      props: { style: { 'grid-column': '1 / -1', height: '64px' } },
    })
    expect(levelRow.children).toContain(level)
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
    const summaryTile = findNode(
      base?.content,
      node => node.props?.tile === true
        && node.children?.[0]?.type === 'row'
        && node.children?.[1]?.ref === 'desktop_statuses',
    )
    const hpColumn = findNode(summaryTile, node => node.type === 'column' && node.children?.some(child => child.ref === 'hp'))
    const sidebar = findNode(
      base?.content,
      node => node.type === 'column' && node.children?.some(child => child.ref === 'feature_widgets'),
    )
    const separateExhaustion = findNode(base?.content, node => node.ref === 'exhaustion')
    const separateStates = findNode(base?.content, node => node.ref === 'states')

    expect(statuses).toBeTruthy()
    expect(summaryTile.props?.tile).toBe(true)
    expect(summaryTile.type).toBe('column')
    const iconColumn = findNode(summaryTile, node => node.type === 'column' && node.children?.some(child => child.ref === 'character_icon'))
    expect(iconColumn.children.map(child => child.ref)).toEqual(['character_icon', 'desktop_status_trigger'])
    expect(iconColumn.props.style.flex).toBe('0 0 110px')
    expect(hpColumn.children.map(child => child.ref)).toEqual(['char_identity', 'hp'])
    expect(hpColumn.children[0].props?.grow).toBeUndefined()
    expect(hpColumn.children[0].props?.basis).toBeUndefined()
    expect(summaryTile.children[1]).toBe(statuses)
    expect(sidebar.children.some(child => child.ref === 'desktop_statuses')).toBe(false)
    expect(separateExhaustion).toBeNull()
    expect(separateStates).toBeNull()
    expect(schema.blocks.states).toBeUndefined()
    expect(schema.blocks.desktop_statuses).toMatchObject({
      type: 'DND_STATUS_OVERVIEW',
      content: {
        states_id: 'states',
        effect_item_type_id: 15,
        exhaustion_id: 'exhaustion',
        inspiration_id: 'inspiration',
        display: 'summary',
      },
    })
    expect(schema.blocks.desktop_status_trigger).toMatchObject({
      type: 'DND_STATUS_OVERVIEW',
      content: { display: 'trigger' },
    })
    expect(schema.blocks.desktop_status_editor).toBeUndefined()
  })

  it('moves the full portrait into the Personality tab', () => {
    const personality = innerTabs.children.find(tab => tab.title === 'Личность')
    const portrait = findNode(personality?.content, node => node.ref === 'ava')
    const headerPortrait = findNode(
      base?.content,
      node => node.ref === 'ava' && node !== portrait,
    )

    expect(portrait?.props).toMatchObject({ width: '200px', height: '260px' })
    expect(headerPortrait).toBeNull()
    expect(schema.blocks.character_icon.type).toBe('DND_CHARACTER_ICON')
  })

  it('keeps derived defenses beside the character resources', () => {
    const featureWidgets = findNode(base?.content, node => node.ref === 'feature_widgets')
    const actions = findNode(base?.content, node => node.ref === 'actions')
    const resources = findNode(base?.content, node => node.ref === 'resources')
    const passiveEffects = findNode(base?.content, node => node.ref === 'passive_effects')
    const defenses = findNode(base?.content, node => node.ref === 'defenses')

    expect(featureWidgets).toBeTruthy()
    expect(actions).toBeTruthy()
    expect(resources).toBeTruthy()
    expect(passiveEffects).toBeNull()
    expect(defenses).toBeTruthy()
    expect(schema.blocks.defenses).toMatchObject({
      type: 'DND_DEFENSES',
      content: { damage_type_suggest_id: 12 },
    })
  })

  it('moves abilities from the sidebar into a visible expanded inner tab', () => {
    const abilities = innerTabs.children.find(tab => tab.title === 'Способности')
    const expanded = ['abilities_class', 'abilities_race', 'abilities_feats']
      .map(ref => findNode(abilities?.content, node => node.ref === ref))
    const sidebarFeatures = findNode(
      base?.content,
      node => node.children?.map(child => child.ref).join(',') === 'abilities_feats,abilities_race,abilities_class',
    )

    expect(abilities).toBeTruthy()
    expect(expanded.every(node => node?.content?.expanded === true)).toBe(true)
    expect(expanded.every(node => node?.content?.divider == null)).toBe(true)
    expect(sidebarFeatures).toBeNull()
    expect(schema.blocks.actions.type).toBe('DND_ACTIONS')
  })
})
