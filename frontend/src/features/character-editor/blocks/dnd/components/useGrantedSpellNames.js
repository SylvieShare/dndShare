import { computed, ref, watch } from 'vue'
import { useCharacterItemCatalog } from '../../../composables/useCharacterItemCatalog'

export function useGrantedSpellNames(grantedIds) {
  const catalog = useCharacterItemCatalog()
  const initial = catalog.snapshot()
  const spellNames = ref(Object.fromEntries(Object.values(initial).map(item => [item.id, item.name])))
  const spellItems = ref(initial)
  const spellLevels = ref(Object.fromEntries(Object.values(initial).map(item => [item.id, Number(item.data?.lvl) || 0])))
  watch(grantedIds, async (ids) => {
    const missing = ids.filter(id => !spellNames.value[id])
    if (!missing.length) return
    const response = await catalog.load(missing)
    const nextNames = { ...spellNames.value }
    const nextLevels = { ...spellLevels.value }
    for (const item of response?.items || []) {
      spellItems.value[item.id] = item
      nextNames[item.id] = item.name
      if (item.data?.lvl != null) nextLevels[item.id] = Number(item.data.lvl) || 0
    }
    spellNames.value = nextNames
    spellLevels.value = nextLevels
  }, { immediate: true })

  const grantedSpellList = computed(() => grantedIds.value.map(id => ({
    ...spellItems.value[id],
    id,
    name: spellNames.value[id] || `#${id}`,
  })))
  return { spellNames, spellLevels, grantedSpellList }
}
