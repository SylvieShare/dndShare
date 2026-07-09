import { ref, onBeforeUnmount } from 'vue'
import { fetchPut } from '@/shared/api/http'

const SAVE_DELAY_MS = 2000

export function useSaveDebounce(uuid, data) {
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
    try {
      await fetchPut('/char/' + uuid + '/data', { data: data.value })
      saveStatus.value = 'idle'
    } catch {
      saveStatus.value = 'error'
    }
  }

  onBeforeUnmount(clearTimers)

  return { saveStatus, pendingSecondsLeft, scheduleSave }
}
