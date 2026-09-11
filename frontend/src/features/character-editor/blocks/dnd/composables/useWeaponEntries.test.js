import { effectScope, nextTick, reactive } from 'vue'
import { expect, it, vi } from 'vitest'
import { useWeaponEntries } from './useWeaponEntries'

it('persists a real magic weapon and preserves its source and resources during editing', async () => {
  const props = reactive({ block: { id: 'weapon' }, value: [{ uid: 'normal', item_id: 49 }, { uid: 'magic', item_id: 49, magic_item_id: 100, params: { magic: { attuned: true, remaining: 4 } } }] })
  const emit = vi.fn((event, id, value) => { props.value = value })
  const scope = effectScope(), loadItems = vi.fn().mockResolvedValue()
  const state = scope.run(() => useWeaponEntries({ props, emit, loadItems }))
  expect(state.entries.value.map(e => e.uid)).toEqual(['normal', 'magic'])
  props.value[1].params.magic.remaining = 1
  await nextTick()
  state.entries.value[1].desc = 'Заметка'
  state.emitChange()
  await nextTick()
  expect(props.value[1]).toMatchObject({ uid: 'magic', item_id: 49, magic_item_id: 100, desc: 'Заметка', params: { magic: { remaining: 1 } } })
  expect(props.value[1]._key).toBeUndefined()
  expect(loadItems).toHaveBeenCalledWith(props.value)
  scope.stop()
})
