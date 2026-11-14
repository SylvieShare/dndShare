import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import { beforeEach, expect, it, vi } from 'vitest'
import { useNotificationsStore } from '@/stores/notifications'
import { localState } from './offline'
import { reportSyncProblem, resetSyncProblems } from './localSyncProblems'
import { useLocalSyncFeedback } from './useLocalSyncFeedback'

vi.mock('./offline', async () => ({ localState: (await import('vue')).reactive({ accountId: null }) }))
beforeEach(() => { setActivePinia(createPinia()); localState.accountId = null; resetSyncProblems() })
it('emits one popup per incident, keeps dismissal quiet and clears on logout', () => {
  const scope = effectScope(), store = useNotificationsStore()
  scope.run(useLocalSyncFeedback)
  try {
    localState.accountId = 1
    reportSyncProblem({ status: 500 }, 'a', 1)
    expect(store.entries).toHaveLength(1)
    expect(store.entries[0].type).toBe('sync-error')
    store.dismiss(store.entries[0].id)
    reportSyncProblem({ status: 500 }, 'a', 1)
    expect(store.entries).toHaveLength(0)
    reportSyncProblem({ status: 426 }, 'b', 1)
    expect(store.entries).toHaveLength(1)
    localState.accountId = null
    expect(store.entries).toHaveLength(0)
    resetSyncProblems()
    localState.accountId = 2
    reportSyncProblem({ status: 500 }, 'a', 1)
    expect(store.entries).toHaveLength(0)
    reportSyncProblem({ status: 426 }, 'b', 2)
    expect(store.entries).toHaveLength(1)
  } finally { scope.stop(); store.clear() }
})
