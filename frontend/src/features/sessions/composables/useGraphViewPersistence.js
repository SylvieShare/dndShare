import { onBeforeUnmount } from 'vue'

export function useGraphViewPersistence({ pan, zoom, getKey, clamp, delay = 120 }) {
  let timer = null
  let pending = null

  function read(graphKey) {
    try {
      return JSON.parse(localStorage.getItem(getKey(graphKey)) || 'null')
    } catch {
      return null
    }
  }

  function persist() {
    if (!pending) return
    try { localStorage.setItem(pending.key, JSON.stringify(pending.value)) } catch { /* ignore unavailable storage */ }
    pending = null
    timer = null
  }

  function save() {
    clamp()
    pending = { key: getKey(), value: { ...pan.value, zoom: zoom.value } }
    if (timer != null) clearTimeout(timer)
    timer = setTimeout(persist, delay)
  }

  onBeforeUnmount(() => {
    if (timer != null) clearTimeout(timer)
    persist()
  })

  return { read, save }
}
