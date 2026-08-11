import { computed } from 'vue'
import { useSuggestStore } from '@/stores/suggest'

const COIN_SUGGEST_TYPE_ID = 17

export function useCostFormatter(suggestTypeId = COIN_SUGGEST_TYPE_ID) {
  const suggestStore = useSuggestStore()
  suggestStore.ensure(suggestTypeId)

  const suggestById = computed(() => {
    const map = {}
    for (const item of suggestStore.items(suggestTypeId) || []) map[item.id] = item
    return map
  })

  function coinLabel(suggestId) {
    const s = suggestById.value[suggestId]
    if (!s) return ''
    return s.code || s.value || ''
  }

  function format(cost) {
    if (cost == null || cost === '') return ''
    if (typeof cost === 'object') {
      const value = cost.value
      const label = coinLabel(cost.suggest_id)
      if (value == null && !label) return ''
      if (value == null) return label
      if (!label) return String(value)
      return `${value} ${label}`
    }
    return ''
  }

  function hasCost(cost) {
    return !!format(cost)
  }

  return { format, hasCost }
}
