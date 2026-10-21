import { ref } from 'vue'
import { createDocumentSync } from '@/shared/lib/documentSync'
import { applyDocumentPatches, documentDiff } from '@/shared/lib/documentPatch'

export function useEncounterPersistence({
  source,
  send,
  load,
  storageKey,
  debounceMs,
}) {
  const loadError = ref(''),
    saveError = ref('')
  let sync,
    timer,
    stopped = false
  function markReady(snapshot = { data: source.value, version: 0 }) {
    sync?.stop()
    loadError.value = saveError.value = ''
    sync = createDocumentSync({
      ...snapshot,
      send,
      load,
      storageKey,
      onData: (next) => {
        const current = source.value
        const result = applyDocumentPatches(
          current,
          documentDiff(current, next),
        )
        if (current !== result) source.value = result
      },
      onStatus: (state) => {
        saveError.value =
          state.status === 'retrying'
            ? 'Не удалось сохранить состояние боя. Повторяем попытку…'
            : state.error
              ? state.status === 'conflict'
                ? 'Одни и те же данные боя изменились на сервере. Несохранённые правки остались в этом браузере.'
                : state.error.message || 'Не удалось сохранить состояние боя.'
              : ''
      },
    })
    if (sync.pending) void sync.flush()
  }
  function markLoadFailed() {
    sync?.stop()
    sync = null
    loadError.value =
      'Не удалось загрузить состояние боя. Изменения не сохраняются.'
  }
  function scheduleSave() {
    if (!sync || stopped || sync.applying) return
    sync.edit(source.value, {}, { record: false })
    clearTimeout(timer)
    timer = setTimeout(flushSave, debounceMs)
  }
  function flushSave() {
    clearTimeout(timer)
    return sync?.flush() || Promise.resolve(false)
  }
  function stop() {
    clearTimeout(timer)
    if (sync) {
      sync.edit(source.value, {}, { record: false })
      void sync.flush()
      sync.stop()
    }
    stopped = true
  }
  return {
    loadError,
    saveError,
    markReady,
    markLoadFailed,
    scheduleSave,
    flushSave,
    stop,
  }
}
