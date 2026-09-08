import { onBeforeUnmount } from 'vue'

export function useRafLatest(callback) {
  let frame = null
  let pending = null

  function cancel() {
    if (frame != null) cancelAnimationFrame(frame)
    frame = null
    pending = null
  }

  function schedule(value) {
    pending = value
    if (frame != null) return
    frame = requestAnimationFrame(() => {
      frame = null
      const next = pending
      pending = null
      if (next != null) callback(next)
    })
  }

  onBeforeUnmount(cancel)
  return { schedule, cancel }
}
