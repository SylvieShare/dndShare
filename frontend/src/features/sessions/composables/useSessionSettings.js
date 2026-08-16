import { reactive, watch } from 'vue'

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

export function useSessionSettings({ sessionUuid }) {
  const settings = reactive(readSettings(sessionUuid))

  watch(settings, value => {
    try {
      localStorage.setItem(sessionSettingsKey(sessionUuid), JSON.stringify({
        autoRollNpcHp: value.autoRollNpcHp,
      }))
    } catch { /* localStorage can be unavailable in private mode */ }
  }, { deep: true })

  function update(key, value) {
    if (!(key in DEFAULTS)) return
    settings[key] = value === true
  }

  return { settings, update }
}
