import { ref, onBeforeUnmount } from 'vue'
import { fetchPut } from '@/shared/api/http'

const SAVE_DELAY_MS = 1000

export function useSaveDebounce(uuid, data, options = {}) {
  const saveStatus = ref('idle')
  const pendingSecondsLeft = ref(0)

  let saveTimer = null
  let countdownInterval = null

  function clearTimers() {
    clearTimeout(saveTimer)
    clearInterval(countdownInterval)
    saveTimer = null
    countdownInterval = null
  }

  function scheduleSave() {
    clearTimers()
    saveStatus.value = 'pending'
    pendingSecondsLeft.value = Math.ceil(SAVE_DELAY_MS / 1000)

    countdownInterval = setInterval(() => {
      if (pendingSecondsLeft.value > 1) pendingSecondsLeft.value--
      else clearInterval(countdownInterval)
    }, 1000)

    saveTimer = setTimeout(save, SAVE_DELAY_MS)
  }

  async function save() {
    clearTimers()
    saveStatus.value = 'saving'
    const events = options.takeEvents?.() || []
    try {
      await fetchPut('/char/' + uuid + '/data', { data: data.value, events })
      saveStatus.value = 'idle'
    } catch {
      options.restoreEvents?.(events)
      saveStatus.value = 'error'
    }
  }

  function retrySave() {
    if (saveStatus.value === 'error') void save()
  }

  function dismissSaveError() {
    if (saveStatus.value === 'error') saveStatus.value = 'idle'
  }

  onBeforeUnmount(() => {
    if (saveStatus.value === 'pending') void save()
    else clearTimers()
  })

  return { saveStatus, pendingSecondsLeft, scheduleSave, retrySave, dismissSaveError }
}
