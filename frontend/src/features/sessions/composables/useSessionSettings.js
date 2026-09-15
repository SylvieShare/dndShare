import { reactive, ref, watch } from 'vue'
import { updateSessionSetting } from '@/shared/api/sessionsApi'

const settingPaths = {
  'interactions.items': ['interactions', 'items'],
  'interactions.potions': ['interactions', 'potions'],
  'interactions.spells': ['interactions', 'spells'],
  'autoAccept.items': ['autoAccept', 'items'],
  'autoAccept.potions': ['autoAccept', 'potions'],
  'autoAccept.spells': ['autoAccept', 'spells'],
  'players.seeClass': ['players', 'seeClass'],
  'players.seeRace': ['players', 'seeRace'],
  'players.seeHp': ['players', 'seeHp'],
  'players.openSheets': ['players', 'openSheets'],
  'combat.autoRollNpcHp': ['combat', 'autoRollNpcHp'],
}

export function useSessionSettings({ sessionUuid, session }) {
  const settings = reactive({ players: {}, combat: {}, autoAccept: {}, interactions: {} })
  const saving = ref(false)
  const error = ref('')
  watch(() => session.value?.settings, value => {
    if (!value) return
    settings.players = { ...value.players }
    settings.combat = { ...value.combat }
    settings.autoAccept = { ...value.autoAccept }
    settings.interactions = { ...value.interactions }
  }, { immediate: true })

  async function update(key, value) {
    const path = settingPaths[key]
    if (!path || saving.value || !session.value) return
    saving.value = true
    error.value = ''
    try {
      await updateSessionSetting(sessionUuid, key, value === true)
      const [section, field] = path
      settings[section][field] = value === true
      session.value = {
        ...session.value,
        settings: {
          ...session.value.settings,
          [section]: { ...session.value.settings[section], [field]: value === true },
        },
      }
    } catch { error.value = 'Не удалось сохранить настройку. Попробуйте ещё раз.' }
    finally { saving.value = false }
  }

  return { settings, update, saving, error }
}
