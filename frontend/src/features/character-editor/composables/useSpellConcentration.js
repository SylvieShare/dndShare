import { onScopeDispose, reactive, watch } from 'vue'
import { fetchGet, fetchPost } from '@/shared/api/http'
import { notifyApplication } from '@/features/notifications/lib/notifyApplication'

export function useSpellConcentration({ uuid, version, isOwner, state, mutate }) {
  const concentration = reactive({ current: null, loading: false, error: '' })
  let sequence = 0
  let pending = null
  async function refresh() {
    const request = ++sequence
    concentration.loading = true
    try {
      const response = await fetchGet(`/char/${uuid}/concentration`)
      if (request === sequence) { concentration.current = response.concentration; concentration.error = '' }
    } catch (error) {
      if (request === sequence) concentration.error = error.message || 'Не удалось загрузить концентрацию'
    } finally { if (request === sequence) concentration.loading = false }
  }
  async function change(spellId, endId = '') {
    if (!isOwner.value || state.busy) return false
    const key = `concentration:${spellId}:${endId}`
    if (pending?.key !== key) pending = { key, clientActionId: crypto.randomUUID() }
    const sent = await mutate(() => fetchPost(`/char/${uuid}/concentration`, {
      spellId, endId, clientActionId: pending.clientActionId, version: version.value,
    }))
    if (sent) pending = null
    else concentration.error = state.error
    return sent
  }
  async function self(item, optionKey) {
    if (!isOwner.value || state.busy) return false
    const key = `spell:${item.id}:${optionKey}`
    if (pending?.key !== key) pending = { key, clientActionId: crypto.randomUUID() }
    let response
    const sent = await mutate(async () => {
      response = await fetchPost(`/char/${uuid}/spell-use`, {
        spellId: item.id, optionKey, clientActionId: pending.clientActionId, version: version.value,
      })
    })
    if (sent) { pending = null; notifyApplication(item.name, response.result) }
    else concentration.error = state.error
    return sent
  }
  watch(version, refresh, { immediate: true })
  onScopeDispose(() => { sequence++ })
  return reactive({ state: concentration, refresh, start: item => change(item.id), end: () => change(0, concentration.current?.id), self })
}
