import { onScopeDispose, reactive } from 'vue'
import { itemsApi } from '@/shared/api/itemsApi'
import { notifyApplication } from '@/features/notifications/lib/notifyApplication'
import { fetchPost } from '@/shared/api/http'

export function useUsableApplications({ uuid, version, mutate, state, isOwner }) {
  const application = reactive({ choice: null, error: '', choosing: false })
  let chooseResolve = null
  let pending = null
  async function choose(entry) {
    if (application.choosing) return null
    application.choosing = true
    try {
      const id = entry.magic_item_id ?? entry.item_id ?? entry.id
      if (!id) return ''
      const response = await itemsApi.byIds([id])
      const item = response.items?.find(item => String(item.id) === String(id))
      if (!item) throw new Error('Не удалось загрузить механику предмета')
      const choices = item.data?.usable?.choices || []
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
  async function self(entry, source) {
    if (!isOwner.value || state.busy || application.choice) return false
    application.error = ''
    try {
      const optionKey = await choose(entry)
      if (optionKey === null) return false
      const key = `${source}:${entry.uid}:${optionKey}`
      if (pending?.key !== key) pending = { key, clientActionId: crypto.randomUUID() }
      let response
      const sent = await mutate(async () => {
        response = await fetchPost(`/char/${uuid}/usable-use`, { source, entryUid: entry.uid, optionKey, clientActionId: pending.clientActionId, version: version.value })
      })
      if (sent) { pending = null; notifyApplication(entry.name, response.result) }
      else application.error = state.error
      return sent
    } catch (error) { application.error = error.message; return false }
  }
  onScopeDispose(() => select(null))
  return { application, choose, select, self }
}
