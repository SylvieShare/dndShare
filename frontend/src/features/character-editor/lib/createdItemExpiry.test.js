import { expect, it } from 'vitest'
import { expireCreatedItem } from './createdItemExpiry'
const entry = (uid, mode = 'inert') => ({ uid, item_id: 9, count: 7, params: { note: 'keep', creation: { cast_id: 'same', duration: { kind: 'hours', value: 24 }, on_expire: mode } } })
it('removes only the expired stack, preserving other copies of the same cast and container metadata', () => {
  for (const source of ['items', 'weapon', 'potions']) {
    const a = entry('a', 'vanish'), b = entry('b', 'vanish')
    const values = source === 'items' ? { items: { equipped: [b], sections: [{ name: 'bag', items: [a, b] }] } } : { [source]: [a, b] }
    const next = expireCreatedItem(values, 'a')
    expect(source === 'items' ? next.items.sections[0].items : next[source]).toEqual([b])
    if (source === 'items') expect(next.items).toMatchObject({ equipped: [b], sections: [{ name: 'bag' }] })
    expect(a.count).toBe(7)
  }
})
it('can restore inert items but cannot expire permanent or ordinary items', () => {
  const a = entry('a'), permanent = entry('p'); permanent.params.creation.duration.kind = 'permanent'
  const values = { potions: [a, permanent, { uid: 'ordinary', count: 1 }] }
  const next = expireCreatedItem(values, 'a')
  expect(next.potions[0]).toMatchObject({ count: 7, params: { note: 'keep', creation: { expired: true } } })
  expect(expireCreatedItem(next, 'a').potions[0].params.creation.expired).toBe(false)
  expect(expireCreatedItem(values, 'p')).toEqual(values)
  expect(expireCreatedItem(values, 'ordinary')).toEqual(values)
})
