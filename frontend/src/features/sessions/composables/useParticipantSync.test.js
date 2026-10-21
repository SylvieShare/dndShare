import { expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useParticipantSync } from './useParticipantSync'
it('serializes recovery snapshots and coalesces requests received during a read', async () => {
  const participants = ref([{ charId: 1, version: 3, data: { hp: 10 } }])
  let release
  const refreshParticipants = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )
    .mockImplementationOnce(async () => {
      participants.value = [{ charId: 2, version: 7, data: { hp: 8 } }]
    })
  const sync = useParticipantSync({ participants, refreshParticipants })
  const first = sync.requestParticipants()
  sync.requestParticipants()
  sync.requestParticipants()
  expect(refreshParticipants).toHaveBeenCalledOnce()
  release()
  await first
  expect(refreshParticipants).toHaveBeenCalledTimes(2)
  expect(participants.value[0].version).toBe(7)
})
