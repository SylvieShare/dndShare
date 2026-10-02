import { computed, reactive, shallowRef, watch } from 'vue'
import { fetchPost } from '@/shared/api/http'
import { useSuggestStore } from '@/stores/suggest'

export function useCharacterMoneyTransfer({ uuid, data, session, isOwner, version, recipients, mutate, transferState, closePopover }) {
  const suggests = useSuggestStore()
  const state = reactive({ peer: null, currencyId: '', amount: 1, loading: false, error: '' })
  const pending = shallowRef(null)
  let generation = 0
  const coins = computed(() => suggests.items(17).map(coin => ({
    ...coin, amount: Number(data.value?.values?.money?.amounts?.[coin.id]) || 0,
  })))
  const balance = computed(() => coins.value.find(coin => String(coin.id) === state.currencyId)?.amount || 0)
  const request = computed(() => ({ sessionUuid: session.value?.uuid, recipientCharUuid: state.peer?.charUuid,
    currencyId: Number(state.currencyId), amount: Number(state.amount) }))
  const key = computed(() => JSON.stringify(request.value))
  const busy = computed(() => transferState.busy)
  const canSubmit = computed(() => isOwner.value && !busy.value && !state.loading && !!state.peer &&
    recipients.value.some(peer => peer.charUuid === state.peer.charUuid) &&
    coins.value.some(coin => coin.id === request.value.currencyId) && Number.isSafeInteger(request.value.amount) &&
    request.value.amount > 0 && (request.value.amount <= balance.value || pending.value?.key === key.value))

  async function open(peer) {
    if (!isOwner.value || busy.value || !recipients.value.some(player => player.charUuid === peer.charUuid)) return
    const token = ++generation
    closePopover()
    Object.assign(state, { peer, currencyId: '', amount: 1, loading: true, error: '' })
    try {
      await suggests.ensure(17)
      if (token !== generation) return
      state.currencyId = String(coins.value.find(coin => coin.amount > 0)?.id || coins.value[0]?.id || '')
    } catch (error) { if (token === generation) state.error = error.message || 'Не удалось загрузить валюты' }
    finally { if (token === generation) state.loading = false }
  }
  function close() {
    if (busy.value) return
    generation++
    state.peer = null
    state.error = ''
  }
  async function send() {
    if (!canSubmit.value) return false
    state.error = ''
    if (pending.value?.key !== key.value) pending.value = { key: key.value, clientActionId: crypto.randomUUID() }
    const payload = { ...request.value, clientActionId: pending.value.clientActionId }
    const sent = await mutate(() => fetchPost(`/char/${uuid}/money-transfers`, { ...payload, version: version.value }))
    if (sent) { pending.value = null; close() }
    else state.error = transferState.error || 'Не удалось передать деньги'
    return sent
  }
  watch(() => [session.value?.uuid, isOwner.value], () => { close(); pending.value = null })
  return reactive({ state, coins, balance, busy, canSubmit, open, close, send })
}
