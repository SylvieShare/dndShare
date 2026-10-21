import { expect, it } from 'vitest'
import { ref } from 'vue'
import { createLiveRoster } from './liveRoster'
it('applies HP leaves without replacing unchanged participants and preserves pending colors', () => {
  const participants = ref([])
  const receive = createLiveRoster(participants, {
    pendingColors: () => new Set([7]),
  })
  receive({
    data: [
      { charId: 7, color: 'blue', data: { hp: 10 } },
      { charId: 8, data: { hp: 20 } },
    ],
  })
  const other = participants.value[1],
    hp = participants.value[0].data
  participants.value[0].color = 'green'
  receive({
    patches: [
      {
        op: 'set',
        path: [{ idField: 'charId', id: 7 }, 'data', 'hp'],
        value: 9,
      },
      {
        op: 'set',
        path: [{ idField: 'charId', id: 7 }, 'color'],
        value: 'red',
      },
    ],
  })
  expect(participants.value[0].data).toBe(hp)
  expect(participants.value[1]).toBe(other)
  expect(hp.hp).toBe(9)
  expect(participants.value[0].color).toBe('green')
})
