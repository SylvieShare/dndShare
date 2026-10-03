import { onBeforeUnmount, shallowRef, watch } from 'vue'

const FEEDBACK_MS = 1100

// Observe displayed balances; feedback never writes to the character sheet.
export function useMoneyFeedback(getCoins, getLoading) {
  const rows = shallowRef([])
  const changes = shallowRef(new Map())
  const timers = new Map()
  let previous = new Map()
  let initialized = false
  let sequence = 0

  function updateRows(coins) {
    const next = [...coins]
    const ids = new Set(next.map(coin => String(coin.id)))
    for (const [id, change] of changes.value) {
      if (!ids.has(id)) next.splice(Math.min(change.index, next.length), 0, change.coin)
    }
    rows.value = next
  }

  function reset() {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    changes.value = new Map()
  }

  watch(() => [getCoins().map(coin => ({ ...coin })), getLoading()], ([coins, loading]) => {
    const current = new Map(coins.map(coin => [String(coin.id), coin]))
    if (loading || !initialized) {
      reset()
      previous = current
      initialized = !loading
      rows.value = coins
      return
    }

    const nextChanges = new Map(changes.value)
    for (const id of new Set([...previous.keys(), ...current.keys()])) {
      const before = previous.get(id), after = current.get(id)
      const delta = (after?.amount || 0) - (before?.amount || 0)
      if (!delta) continue
      const version = ++sequence
      nextChanges.set(id, { delta, version, coin: after || { ...before, amount: 0 }, index: Math.max(0, rows.value.findIndex(coin => String(coin.id) === id)) })
      clearTimeout(timers.get(id))
      timers.set(id, setTimeout(() => {
        if (changes.value.get(id)?.version !== version) return
        const remaining = new Map(changes.value)
        remaining.delete(id)
        changes.value = remaining
        timers.delete(id)
        updateRows(getCoins())
      }, FEEDBACK_MS))
    }
    previous = current
    changes.value = nextChanges
    updateRows(coins)
  }, { immediate: true })

  onBeforeUnmount(reset)
  return { rows, changes }
}
