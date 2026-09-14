import { getCurrentScope, onScopeDispose, watch } from 'vue'
import { createDeferredTask } from '@/shared/lib/deferredTask'

export function usePersistedDraft(state, { key, serialize = value => value, paused = () => false }) {
  const task = createDeferredTask(() => {
    try { localStorage.setItem(key, JSON.stringify(serialize(state))) } catch { /* quota/private mode */ }
  })
  // Synchronous scheduling makes clear() cancel changes made by reset() in the
  // same tick. Serialization still happens only once, after the debounce.
  const stop = watch(state, () => { if (!paused()) task.schedule() }, { deep: true, flush: 'sync' })
  const flush = () => task.flush()
  const visibilityChanged = () => { if (globalThis.document?.visibilityState === 'hidden') flush() }
  globalThis.window?.addEventListener('pagehide', flush)
  globalThis.document?.addEventListener('visibilitychange', visibilityChanged)
  const dispose = () => {
    stop()
    flush()
    globalThis.window?.removeEventListener('pagehide', flush)
    globalThis.document?.removeEventListener('visibilitychange', visibilityChanged)
  }
  if (getCurrentScope()) onScopeDispose(dispose)
  return {
    dispose,
    flush,
    clear() {
      task.cancel()
      try { localStorage.removeItem(key) } catch { /* quota/private mode */ }
    },
  }
}
