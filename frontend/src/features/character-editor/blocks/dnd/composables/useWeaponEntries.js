import { ref, watch } from 'vue'
import { cleanEntry, defaultEntry, normalizeAddAttacks, normalizeWeaponParams } from '../lib/weaponEntry'

export function useWeaponEntries({ props, emit, loadItems }) {
  const entries = ref([]), loadError = ref('')
  let request = 0
  async function reload() {
    const token = ++request
    loadError.value = ''
    try { await loadItems(props.value || []) }
    catch { if (token === request) loadError.value = 'Не удалось загрузить оружие и его магические источники.' }
  }
  watch(() => props.value, () => {
    entries.value = (props.value || []).map(entry => {
      const row = { ...defaultEntry(), ...entry, params: normalizeWeaponParams(entry.params), add_attacks: normalizeAddAttacks(entry.add_attacks) }
      return { ...row, _key: row.uid }
    })
  }, { immediate: true, deep: true })
  watch(() => props.value, reload, { immediate: true, deep: true })
  function emitChange() { emit('update:value', props.block.id, entries.value.map(cleanEntry)) }
  return { entries, emitChange, loadError, reload }
}
