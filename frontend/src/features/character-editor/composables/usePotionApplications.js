import { onScopeDispose, reactive } from 'vue'
import { itemsApi } from '@/shared/api/itemsApi'
import { fetchPost } from '@/shared/api/http'

export function usePotionApplications({ uuid, version, mutate, state, isOwner }) {
  const application = reactive({ choice: null, result: null, name: '', error: '', choosing: false })
  let chooseResolve = null
  let pending = null
  async function choose(entry) {
    if (application.choosing) return null
    application.choosing = true
    try {
      const id = entry.item_id ?? entry.id
      if (!id) return ''
      const response = await itemsApi.byIds([id])
      const item = response.items?.find(item => String(item.id) === String(id))
      if (!item) throw new Error('Не удалось загрузить механику зелья')
      const choices = item.data?.consumption?.choices || []
      if (!choices.length) return ''
      if (choices.length === 1) return choices[0].key
      application.choice = { name: item.name, choices }
      return await new Promise(resolve => { chooseResolve = resolve })
    } finally { application.choosing = false }
  }
  function select(key) {
    application.choice = null
    chooseResolve?.(key)
    chooseResolve = null
  }
  async function self(entry) {
    if (!isOwner.value || state.busy || application.choice) return false
    application.error = ''
    try {
      const optionKey = await choose(entry)
      if (optionKey === null) return false
      const key = `${entry.uid}:${optionKey}`
      if (pending?.key !== key) pending = { key, clientActionId: crypto.randomUUID() }
      let response
      const sent = await mutate(async () => {
        response = await fetchPost(`/char/${uuid}/potion-use`, { entryUid: entry.uid, optionKey, clientActionId: pending.clientActionId, version: version.value })
      })
      if (sent) { pending = null; application.name = entry.name || 'Зелье'; application.result = response.result }
      else application.error = state.error
      return sent
    } catch (error) { application.error = error.message; return false }
  }
  onScopeDispose(() => select(null))
  return { application, choose, select, self }
}
