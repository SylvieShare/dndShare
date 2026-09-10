import { ref, watch } from 'vue'
import { cleanEntry, defaultEntry, normalizeAddAttacks, normalizeWeaponParams } from '../lib/weaponEntry'
import { equippedMagicWeapons, saveMagicWeaponRows } from '@/features/character-editor/lib/magicWeapons'
import { appendInventoryEntry, takeInventoryEntry } from '../lib/itemPlacement'
import { EQUIPPED_ID } from '../lib/itemSection'

export function useWeaponEntries({ props, emit, charCtx, itemMap, loadItems }) {
  const entries = ref([])
  const loadError = ref('')
  let request = 0
  async function reload() {
    const token = ++request
    loadError.value = ''
    try { await loadItems([...(props.value || []), ...(props.values?.items?.equipped || [])]) }
    catch { if (token === request) loadError.value = 'Не удалось загрузить оружие и его основы.' }
  }
  watch([() => props.value, () => props.values?.items, itemMap], () => {
    entries.value = [...(props.value || []), ...equippedMagicWeapons(props.values, itemMap.value)].map(entry => {
      const row = { ...defaultEntry(), ...entry, params: normalizeWeaponParams(entry.params), add_attacks: normalizeAddAttacks(entry.add_attacks) }
      return { ...row, _key: row.uid }
    })
  }, { immediate: true, deep: true })
  watch([() => props.value, () => props.values?.items], reload, { immediate: true, deep: true })

  function emitChange() {
    const weapon = entries.value.filter(e => !e._inventory).map(cleanEntry)
    const items = saveMagicWeaponRows(props.values?.items, entries.value)
    if (charCtx.updateValues && JSON.stringify(items) !== JSON.stringify(props.values?.items)) charCtx.updateValues({ [props.block.id]: weapon, items })
    else emit('update:value', props.block.id, weapon)
  }
  function removeInventoryWeapon(entry, discard = false) {
    if (!entry?._inventory) return false
    const taken = takeInventoryEntry(props.values?.items, EQUIPPED_ID, entry.uid)
    if (!taken) return true
    const patch = { items: discard ? taken.inventory : appendInventoryEntry(taken.inventory, taken.entry) }
    if (discard && charCtx.characterStatuses?.removeByParam) patch.states = charCtx.characterStatuses.removeByParam('weapon_uid', entry.uid)
    charCtx.updateValues(patch)
    return true
  }
  return { entries, emitChange, removeInventoryWeapon, loadError, reload }
}
