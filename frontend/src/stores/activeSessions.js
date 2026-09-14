import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSessions } from '@/shared/api/sessionsApi'

// Global navigation keeps only the signed-in master's active sessions.
export const useActiveSessionsStore = defineStore('activeSessions', () => {
  const sessions = ref([])
  let userId = null
  let loadedAt = 0
  let revision = 0
  let pending = null
  const changes = new Map()

  function setUser(id) {
    if (id === userId) return
    userId = id
    sessions.value = []
    loadedAt = 0
    revision++
    pending = null
    changes.clear()
  }

  function remember(session) {
    if (!userId || session?.ownerUserId !== userId) return
    revision++
    changes.set(session.uuid, { revision, session })
    loadedAt = 0
    sessions.value = sessions.value.filter(entry => entry.uuid !== session.uuid)
    if (session.status === 'active') sessions.value.unshift(session)
  }

  async function refresh(force = false) {
    if (!userId || pending || (!force && loadedAt && Date.now() - loadedAt < 30000)) return
    const requestRevision = revision
    const requestUser = userId
    const request = getSessions()
    pending = request
    try {
      const response = await request
      if (pending !== request || userId !== requestUser) return
      sessions.value = (response?.sessions || [])
        .filter(entry => entry.myRole === 'gm' && entry.session.ownerUserId === userId && entry.session.status === 'active')
        .map(entry => entry.session)
      for (const change of changes.values()) {
        if (change.revision <= requestRevision) continue
        sessions.value = sessions.value.filter(entry => entry.uuid !== change.session.uuid)
        if (change.session.status === 'active') sessions.value.unshift(change.session)
      }
      changes.clear()
      loadedAt = Date.now()
    } catch { /* Keep known shortcuts; focus or navigation retries the request. */ }
    finally { if (pending === request) pending = null }
  }

  return { sessions, setUser, remember, refresh }
})
