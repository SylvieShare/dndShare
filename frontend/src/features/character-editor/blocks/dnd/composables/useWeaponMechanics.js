import { computed, ref, unref } from 'vue'
import { MAGIC_VALUE_ID } from '@/features/character-editor/lib/characterMagicItems'
import { bindDamageResources, spendDamageResources } from '@/features/character-editor/lib/weaponDamageResources'

export function useWeaponMechanics(charCtx) {
  const error = ref('')
  const resources = computed(() => unref(charCtx.characterResources?.resources) || [])
  function weaponResources(entry) {
    return resources.value.filter(row => row.source?.valueId === MAGIC_VALUE_ID && row.source?.entryKey === entry.uid)
  }
  function toggleResource(resource, pip) {
    if (!charCtx.ownerMode) return
    const current = resources.value.find(row => row.key === resource.key)
    if (!current) return
    const patch = charCtx.characterResources.setAvailable(current.key, pip <= current.value ? pip - 1 : pip)
    charCtx.updateValues(patch)
  }
  function bind(actions) { return bindDamageResources(actions, resources.value, !!charCtx.ownerMode) }
  function spend(actions, keys) {
    const result = spendDamageResources(charCtx.values || {}, unref(charCtx.characterResources?.itemsById) || new Map(), actions, keys, !!charCtx.ownerMode)
    error.value = result.error
    if (result.error) return false
    if (Object.keys(result.patch).length) charCtx.updateValues(result.patch)
    return true
  }
  return { error, weaponResources, toggleResource, bind, spend }
}
