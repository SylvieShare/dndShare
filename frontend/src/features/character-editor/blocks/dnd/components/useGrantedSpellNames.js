import { computed, ref, watch } from 'vue'
import { itemsApi } from '@/shared/api/itemsApi'

export function useGrantedSpellNames(grantedIds) {
  const spellNames = ref({})
  watch(grantedIds, async (ids) => {
    const missing = ids.filter(id => !spellNames.value[id])
    if (!missing.length) return
    const response = await itemsApi.byIds(missing)
    const next = { ...spellNames.value }
    for (const item of response?.items || []) next[item.id] = item.name
    spellNames.value = next
  }, { immediate: true })

  const grantedSpellList = computed(() => grantedIds.value.map(id => ({
    id,
    name: spellNames.value[id] || `#${id}`,
  })))
  return { spellNames, grantedSpellList }
}
