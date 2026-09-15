import { computed, ref, watch } from 'vue'
import { fetchGet } from '@/shared/api/http'
import { generateTreasure, treasureCandidates, treasureOptionsError, treasureText } from '../lib/treasureGenerator'

export function useTreasureGenerator(sourceVersionId) {
  const options = ref({ level: 1, count: 3, pool: 'magic', maxRarity: 1, typeId: '', publicOnly: true, goldMin: 10, goldMax: 50 })
  const items = ref([]), loading = ref(false), error = ref(''), result = ref(null), selected = ref(null), copyLabel = ref('Скопировать')
  const types = [{ id: 1, name: 'Оружие' }, { id: 2, name: 'Вещи' }, { id: 10, name: 'Зелья' }, { id: 12, name: 'Доспехи' }, { id: 13, name: 'Транспорт' }, { id: 14, name: 'Инструменты' }, { id: 19, name: 'Магические предметы' }]
  const visibleTypes = computed(() => types.filter(t => options.value.pool === 'all' || (options.value.pool === 'magic') === [10, 19].includes(t.id)))
  const validation = computed(() => treasureOptionsError(options.value))
  const candidates = computed(() => treasureCandidates(items.value, options.value))
  let request = 0
  async function load() {
    if (!sourceVersionId.value) return
    const token = ++request
    loading.value = true; error.value = ''; result.value = null
    try {
      const response = await fetchGet(`/master-tools/treasure-pool?sourceVersionId=${sourceVersionId.value}`)
      if (token !== request) return
      if (!Array.isArray(response?.items)) throw new Error('pool')
      items.value = response.items
    } catch { if (token === request) error.value = 'Не удалось загрузить каталог сокровищ.' }
    finally { if (token === request) loading.value = false }
  }
  watch(sourceVersionId, load, { immediate: true })
  function generate() { result.value = generateTreasure(items.value, options.value); copyLabel.value = 'Скопировать' }
  async function copy() { try { await navigator.clipboard.writeText(treasureText(result.value)); copyLabel.value = 'Скопировано' } catch { copyLabel.value = 'Не удалось скопировать' } }

  return { options, items, loading, error, result, selected, copyLabel, visibleTypes, validation, candidates, load, generate, copy }
}
