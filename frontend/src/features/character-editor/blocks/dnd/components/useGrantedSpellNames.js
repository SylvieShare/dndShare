import { computed, ref, watch } from 'vue'
import { itemsApi } from '@/shared/api/itemsApi'

export function useGrantedSpellNames(grantedIds) {
  const spellNames = ref({})
  const spellLevels = ref({})
  watch(grantedIds, async (ids) => {
    const missing = ids.filter(id => !spellNames.value[id])
    if (!missing.length) return
    const response = await itemsApi.byIds(missing)
    const nextNames = { ...spellNames.value }
    const nextLevels = { ...spellLevels.value }
    for (const item of response?.items || []) {
      nextNames[item.id] = item.name
      if (item.data?.lvl != null) nextLevels[item.id] = Number(item.data.lvl) || 0
    }
    spellNames.value = nextNames
    spellLevels.value = nextLevels
  }, { immediate: true })

  const grantedSpellList = computed(() => grantedIds.value.map(id => ({
    id,
    name: spellNames.value[id] || `#${id}`,
  })))
  return { spellNames, spellLevels, grantedSpellList }
}
