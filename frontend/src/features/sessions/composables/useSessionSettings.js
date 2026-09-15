import { reactive, ref, watch } from 'vue'
import { updateSessionSetting } from '@/shared/api/sessionsApi'

const DEFAULTS = Object.freeze({
  autoRollNpcHp: false,
})

export function sessionSettingsKey(sessionUuid) {
  return `dnd-share:session-settings:v1:${sessionUuid}`
}

function readSettings(sessionUuid) {
  try {
    const saved = JSON.parse(localStorage.getItem(sessionSettingsKey(sessionUuid)) || 'null')
    return {
      autoRollNpcHp: saved?.autoRollNpcHp === true,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function useSessionSettings({ sessionUuid, session }) {
  const settings = reactive(readSettings(sessionUuid))

  watch(settings, value => {
    try {
      localStorage.setItem(sessionSettingsKey(sessionUuid), JSON.stringify({
        autoRollNpcHp: value.autoRollNpcHp,
      }))
    } catch { /* localStorage can be unavailable in private mode */ }
  }, { deep: true })

  const saving = ref(false)
  const error = ref('')
  const sharedKeys = ['playersSeeClass', 'playersSeeRace', 'playersSeeHp', 'playersOpenSheets']
  if (session) watch(() => session.value?.settings, value => {
    if (value) for (const key of sharedKeys) settings[key] = value[key] === true
  }, { immediate: true })

  async function update(key, value) {
    if (sharedKeys.includes(key)) {
      if (saving.value) return
      saving.value = true
      error.value = ''
      try {
        await updateSessionSetting(sessionUuid, key, value === true)
        settings[key] = value === true
        if (session?.value) session.value = { ...session.value, settings: { ...session.value.settings, [key]: value === true } }
      } catch { error.value = 'Не удалось сохранить настройку. Попробуйте ещё раз.' }
      finally { saving.value = false }
      return
    }
    if (!(key in DEFAULTS)) return
    settings[key] = value === true
  }

  return { settings, update, saving, error }
}
