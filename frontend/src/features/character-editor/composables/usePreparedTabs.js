import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'

// Each retained pane mounts in a separate idle task. A drag never starts a new mount.
export function usePreparedTabs(tabs, selected, busy) {
  const prepared = shallowRef(new Set())
  let ticket = null
  let stopped = false
  const key = (tab, index) => String(tab?.id ?? index)
  const isReady = index => prepared.value.has(key(tabs.value[index], index))
  const allReady = computed(() => tabs.value.every((_, index) => isReady(index)))

  function cancel() {
    if (ticket == null) return
    if (typeof window.requestIdleCallback === 'function') window.cancelIdleCallback(ticket)
    else window.clearTimeout(ticket)
    ticket = null
  }

  function schedule() {
    if (stopped || ticket != null || allReady.value || typeof window === 'undefined') return
    const step = () => {
      ticket = null
      if (stopped) return
      if (!busy.value) {
        const index = isReady(selected.value)
          ? tabs.value.findIndex((_, index) => !isReady(index)) : selected.value
        if (index >= 0 && index < tabs.value.length)
          prepared.value = new Set([...prepared.value, key(tabs.value[index], index)])
      }
      schedule()
    }
    ticket = typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback(step, { timeout: 250 }) : window.setTimeout(step, 16)
  }

  watch(() => tabs.value.map(key).join('|'), () => {
    const keys = new Set(tabs.value.map(key))
    prepared.value = new Set([...prepared.value].filter(id => keys.has(id)))
    schedule()
  }, { immediate: true })
  watch(selected, schedule)
  onBeforeUnmount(() => { stopped = true; cancel() })
  return { isReady, allReady }
}
