import { ref, onBeforeUnmount } from 'vue'
import { fetchPut } from '@/shared/api/http'

const SAVE_DELAY_MS = 1000

export function useSaveDebounce(uuid, data, options = {}) {
  const saveStatus = ref('idle')
  const saveError = ref('')
  const pendingSecondsLeft = ref(0)
  let saveTimer = null
  let countdownInterval = null
  let saving = null
  let dirty = false
  let revisionConflict = false

  function clearTimers() {
    clearTimeout(saveTimer)
    clearInterval(countdownInterval)
    saveTimer = null
    countdownInterval = null
  }

  function scheduleSave() {
    clearTimers()
    dirty = true
    if (revisionConflict) return
    saveStatus.value = 'pending'
    pendingSecondsLeft.value = Math.ceil(SAVE_DELAY_MS / 1000)
    countdownInterval = setInterval(() => {
      if (pendingSecondsLeft.value > 1) pendingSecondsLeft.value--
      else clearInterval(countdownInterval)
    }, 1000)
    saveTimer = setTimeout(flushSave, SAVE_DELAY_MS)
  }

  async function flushSave() {
    clearTimers()
    if (saving) await saving
    if (revisionConflict) return false
    if (!dirty) return saveStatus.value === 'idle'
    saving = save()
    const success = await saving
    saving = null
    if (success && dirty) return flushSave()
    return success
  }

  async function save() {
    saveStatus.value = 'saving'
    dirty = false
    const events = options.takeEvents?.() || []
    try {
      const response = await fetchPut('/char/' + uuid + '/data', { data: data.value, events, version: options.version?.value })
      if (options.version) options.version.value = response.version
      saveStatus.value = dirty ? 'pending' : 'idle'
      saveError.value = ''
      return true
    } catch (error) {
      dirty = true
      options.restoreEvents?.(events)
      revisionConflict = error.status === 409
      saveError.value = revisionConflict
        ? 'Лист изменился на сервере. Скопируйте нужные правки и обновите страницу, чтобы загрузить актуальный инвентарь.'
        : 'Проверьте соединение и попробуйте снова.'
      saveStatus.value = 'error'
      return false
    }
  }

  function retrySave() {
    if (saveStatus.value === 'error') void flushSave()
  }
  function dismissSaveError() {
    // Keep the unsaved draft protected from background server refreshes.
    saveError.value = ''
  }
  onBeforeUnmount(() => {
    if (saveStatus.value === 'pending') void flushSave()
    else clearTimers()
  })
  return { saveStatus, saveError, pendingSecondsLeft, scheduleSave, retrySave, dismissSaveError, flushSave }
}
