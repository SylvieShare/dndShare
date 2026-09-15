import { describe, expect, it } from 'vitest'
import { groupSessionEvents, sessionEventActorKey, sessionEventActorKind, sessionEventActorLabel } from './sessionEventView'
import { sessionEventAction, sessionEventDetails, sessionEventEntity } from './sessionEventEntity'

const event = (id, data = {}, actor = {}) => ({ id, createdAt: `2026-09-13T10:${String(id).padStart(2, '0')}:00Z`,
  actorCharUuid: 'char-1', actorName: 'Лиора', authorUserId: 10, authorName: 'alice', type: 'dice_roll', data, ...actor })

describe('session chronicle grouping', () => {
  it('combines consecutive actor and user events across minutes and dates without changing their order', () => {
    const groups = groupSessionEvents([event(1, {}, { createdAt: '2026-09-12T09:00:00Z' }), event(2), event(3)])
    expect(groups).toHaveLength(1)
    expect(groups[0].events.map(row => row.id)).toEqual([3, 2, 1])
    expect(groups[0]).toMatchObject({ label: 'Лиора', authorName: 'alice', kind: 'character' })
  })
  it('separates authors controlling the same character and does not merge nonadjacent actors', () => {
    const groups = groupSessionEvents([event(1), event(2, {}, { authorUserId: 11 }), event(3)])
    expect(groups.map(group => group.events.map(row => row.id))).toEqual([[3], [2], [1]])
    expect(sessionEventActorKey(event(1))).not.toBe(sessionEventActorKey(event(2, {}, { authorUserId: 11 })))
  })
  it('groups consecutive actions and dependencies by their item, retaining other events between them', () => {
    const data = { source: { itemId: 42, name: 'Посох' } }
    const groups = groupSessionEvents([event(1, data), event(2, { ability: { id: 2, name: 'Ловкость' } }), event(3, data), event(4, data)])
    expect(groups[0].entities.map(group => group.events.map(row => row.id))).toEqual([[4, 3], [2], [1]])
    expect(groups[0].entities[0].entity).toMatchObject({ itemId: 42, name: 'Посох' })
  })
  it('keeps anonymous rolls separate and combines all spell circles and recovery pools', () => {
    const spell = (id, pool, level) => event(id, { slotPool: pool, slotLevel: level }, { type: 'spell_slot_changed' })
    const groups = groupSessionEvents([event(1), event(2), spell(3, 'long_rest', 1), spell(4, 'short_rest', 1), spell(5, 'short_rest', 2)])
    expect(groups[0].entities).toHaveLength(3)
    expect(groups[0].entities[0].entity.name).toBe('Ячейки заклинаний')
    expect(groups[0].entities[0].events.map(row => row.id)).toEqual([5, 4, 3])
    expect(groups[0].entities[0].events.map(row => [row.data.slotPool, row.data.slotLevel]))
      .toEqual([['short_rest', 2], ['short_rest', 1], ['long_rest', 1]])
  })
  it('uses actor snapshots and distinguishes DM, character and creature artwork', () => {
    expect(sessionEventActorLabel({ actorName: ' Лиора ' })).toBe('Лиора')
    expect(sessionEventActorKind({ authorIsSessionOwner: true })).toBe('dm')
    expect(sessionEventActorKind({ actorItemId: 42 })).toBe('creature')
    expect(sessionEventActorKind({ actorCharUuid: 'char-1' })).toBe('character')
  })
  it('resolves item references and removes only the repeated entity name from actions', () => {
    expect(sessionEventEntity(event(1, { spellId: 42 }))).toMatchObject({ itemId: 42 })
    expect(sessionEventAction({ action: 'Посох: огненный шар' }, 'Посох')).toBe('огненный шар')
    expect(sessionEventAction({ action: 'Атака: Посох' }, 'Посох')).toBe('Атака')
    expect(sessionEventAction({ action: 'Посох цели: разрушен' }, 'Посох')).toBe('Посох цели: разрушен')
    expect(sessionEventDetails({ type: 'spell_used', data: { slotPool: 'slotless', spellLevel: 3 } })).toBe('Без расхода ячейки')
  })
})


it('distinguishes same-name NPC instances and preserves different marker snapshots', () => {
  const npc = (id, uid, letter, color) => event(id, { npcActor: { uid, name: 'Кобольд', letter, color } }, { actorCharUuid: null, actorName: 'Кобольд' })
  expect(groupSessionEvents([npc(1, 'a', 'A', 'red'), npc(2, 'b', 'B', 'blue')])).toHaveLength(2)
  expect(groupSessionEvents([npc(1, 'a', 'A', 'red'), npc(2, 'a', 'B', 'blue')])).toHaveLength(2)
})
