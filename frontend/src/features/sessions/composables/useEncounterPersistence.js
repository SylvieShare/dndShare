import { ref } from 'vue'

const RETRY_DELAY_MS = 2000

function snapshot(value) {
  return JSON.parse(JSON.stringify(value))
}

export function useEncounterPersistence({ source, save, debounceMs }) {
  const loadError = ref('')
  const saveError = ref('')
  let ready = false
  let stopped = false
  let dirty = false
  let revision = 0
  let saveTimer = null
  let saveChain = Promise.resolve()

  function clearSaveTimer() {
    if (saveTimer != null) clearTimeout(saveTimer)
    saveTimer = null
  }

  function markReady() {
    ready = true
    loadError.value = ''
  }

  function markLoadFailed() {
    ready = false
    loadError.value = 'Не удалось загрузить состояние боя. Изменения не сохраняются.'
  }

  function scheduleSave() {
    if (!ready || stopped) return
    dirty = true
    revision += 1
    clearSaveTimer()
    saveTimer = setTimeout(flushSave, debounceMs)
  }

  function enqueueSave(data, savedRevision, retryOnFailure) {
    saveChain = saveChain
      .catch(() => {})
      .then(() => save(data))
      .then(() => {
        if (savedRevision === revision) dirty = false
        saveError.value = ''
      })
      .catch(() => {
        if (savedRevision !== revision || stopped || !retryOnFailure) return
        dirty = true
        saveError.value = 'Не удалось сохранить состояние боя. Повторяем попытку…'
        clearSaveTimer()
        saveTimer = setTimeout(flushSave, RETRY_DELAY_MS)
      })
    return saveChain
  }

  function flushSave() {
    clearSaveTimer()
    if (!ready || !dirty) return saveChain
    const savedRevision = revision
    dirty = false
    return enqueueSave(snapshot(source.value), savedRevision, true)
  }

  function stop() {
    clearSaveTimer()
    if (ready && dirty) {
      const savedRevision = revision
      dirty = false
      enqueueSave(snapshot(source.value), savedRevision, false)
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
