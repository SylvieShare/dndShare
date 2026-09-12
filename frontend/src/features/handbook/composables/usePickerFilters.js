import { computed, ref, watch } from 'vue'

function normalizeFilterValues(source) {
  return Object.fromEntries(Object.entries(source || {}).flatMap(([key, value]) => {
    if (value == null || value === '') return []
    if (typeof value === 'boolean') return [[key, value]]
    return [[key, Array.isArray(value) ? [...value] : [value]]]
  }))
}

export function usePickerFilters(props) {
  const normalizedFixedFilters = computed(() => normalizeFilterValues(props.fixedFilters))
  const normalizedDefaultFilters = computed(() => normalizeFilterValues(props.defaultFilters))
  const initialFilters = () => ({ ...normalizedDefaultFilters.value, ...normalizedFixedFilters.value })
  const filters = ref(initialFilters())

  function resetFilters() {
    filters.value = initialFilters()
  }

  function updateFilters(next) {
    filters.value = { ...(next || {}), ...normalizedFixedFilters.value }
  }

  watch(normalizedFixedFilters, (next, previous) => {
    const previousKeys = new Set(Object.keys(previous || {}))
    const editable = Object.fromEntries(Object.entries(filters.value).filter(([key]) => !previousKeys.has(key)))
    filters.value = { ...editable, ...next }
  }, { deep: true })

  return { filters, normalizedFixedFilters, normalizedDefaultFilters, updateFilters, resetFilters }
}
