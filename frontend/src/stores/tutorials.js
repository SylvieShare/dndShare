import { defineStore } from 'pinia'
import { fetchGet, fetchPost, fetchPut } from '@/shared/api/http'
import { useAccountStore } from '@/stores/account'
import { hasSeenTutorial, tutorialKey } from '@/features/tutorials/lib/tutorialIdentity'

export const useTutorialsStore = defineStore('tutorials', {
  state: () => ({ entries: [], userId: null, loaded: false, loading: null, activeOwner: null }),
  actions: {
    async ensure() {
      const account = useAccountStore()
      const user = await account.ensureAuth()
      if (!user?.id) return false
      if (this.userId !== user.id) {
        this.userId = user.id
        this.entries = []
        this.loaded = false
        this.loading = null
      }
      if (this.loaded) return true
      if (this.loading) return this.loading
      const userId = user.id
      this.loading = fetchGet('/account/tutorials').then(result => {
        if (this.userId !== userId) return false
        this.entries = result.tutorials || []
        this.loaded = true
        return true
      }).finally(() => { if (this.userId === userId) this.loading = null })
      return this.loading
    },
    seen(context) { return hasSeenTutorial(this.entries, context) },
    async save(context, status) {
      const userId = this.userId
      const entry = { ...context, status }
      await fetchPut('/account/tutorials', entry)
      if (this.userId !== userId) return
      const previous = this.entries.find(row => tutorialKey(row) === tutorialKey(entry))
      // Match the server: an older tab or a skipped replay cannot undo completion.
      const preserve = previous && (previous.revision > entry.revision
        || (previous.revision === entry.revision && previous.status === 'completed'))
      this.entries = [...this.entries.filter(row => tutorialKey(row) !== tutorialKey(entry)), preserve ? previous : entry]
    },
    async reset(context) {
      const userId = this.userId
      const { flowId, sourceKey, device } = context
      await fetchPost('/account/tutorials/reset', { flowId, sourceKey, device })
      if (this.userId !== userId) return
      this.entries = this.entries.filter(row => tutorialKey(row) !== tutorialKey(context))
    },
  },
})
