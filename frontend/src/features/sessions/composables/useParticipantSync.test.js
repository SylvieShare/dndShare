import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('@/shared/api/sessionsApi', () => ({ pollChars: vi.fn() }))

import { pollChars } from '@/shared/api/sessionsApi'
import { useParticipantSync } from './useParticipantSync'

describe('session participant live synchronization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('refreshes only invalidated character versions', async () => {
    const participants = ref([
      { charId: 1, version: 3, data: { hp: 10 } },
      { charId: 2, version: 7, data: { hp: 8 } },
    ])
    pollChars.mockResolvedValue([{ charId: 2, changed: true, version: 8, data: { hp: 4 } }])
    const refreshParticipants = vi.fn()
    const sync = useParticipantSync({ participants, refreshParticipants })

    await sync.requestCharacters([2])

    expect(pollChars).toHaveBeenCalledWith([{ charId: 2, version: 7 }])
    expect(refreshParticipants).not.toHaveBeenCalled()
    expect(participants.value[1]).toEqual(expect.objectContaining({ version: 8, data: { hp: 4 } }))
  })

  it('uses one authoritative participant snapshot for a membership invalidation', async () => {
    const participants = ref([{ charId: 1, version: 3, data: {} }])
    const refreshParticipants = vi.fn(async () => {
      participants.value = [{ charId: 2, version: 1, data: {} }]
    })
    const sync = useParticipantSync({ participants, refreshParticipants })

    await sync.requestParticipants()

    expect(refreshParticipants).toHaveBeenCalledOnce()
    expect(pollChars).not.toHaveBeenCalled()
    expect(sync.versions.value).toEqual({ 2: 1 })
  })
})
