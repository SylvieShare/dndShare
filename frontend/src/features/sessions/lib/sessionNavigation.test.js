import { expect, it } from 'vitest'
import { selectedSessionNavigation, sessionNavigationItems } from './sessionNavigation'

it('groups play, world catalogues and journals while retaining role boundaries and tutorial targets', () => {
  const dm = sessionNavigationItems({isDm:true,combatActive:false,encounterActive:false})
  expect(dm.map(item => item.key)).toEqual(['story','combat','maps','globalMaps','locations','npcs','quests','materials','journal','events','settings'])
  expect(dm.filter(item => item.divider).map(item => item.key)).toEqual(['locations','journal'])
  expect(dm.find(item => item.key === 'globalMaps').attrs['data-tutorial']).toBe('session-global-navigation')
  const player = sessionNavigationItems({isDm:false,combatActive:false,encounterActive:false})
  expect(player.map(item => item.key)).toEqual(['story','combat'])
})
it('keeps the running encounter status independent of the selected workspace and preserves shortcuts', () => {
  const items = sessionNavigationItems({isDm:true,combatActive:false,encounterActive:true})
  const combat = items.find(item => item.key === 'combat')
  expect(combat.attrs['data-combat-state']).toBe('closed-running')
  expect(combat.ariaLabel).toBe('Открыть бой · бой идёт')
  expect(combat.attrs['aria-keyshortcuts']).toBe('Shift+B')
  expect(items.find(item => item.key === 'events').attrs['aria-keyshortcuts']).toBe('Alt+8')
  expect(selectedSessionNavigation('story',true)).toBe('combat')
  expect(selectedSessionNavigation('maps',true)).toBe('maps')
  expect(selectedSessionNavigation('story',false)).toBe('story')
})
