import { computed, onScopeDispose, ref, watch } from 'vue'
import { fetchGet } from '@/shared/api/http'
import { itemsApi } from '@/shared/api/itemsApi'
import { toggleItemId, uniqueItemIds } from '../objects/lib/itemSelection'

const PAGE_SIZE = 40

export function useItemMultiSelect(props, emit) {
  const open = ref(false)
  const search = ref('')
  const draft = ref([])
  const items = ref([])
  const cache = ref({})
  const loading = ref(false)
  const error = ref('')
  const hydrationError = ref('')
  const hasMore = ref(false)
  let request = 0
  let hydrationRequest = 0
  let timer
  let disposed = false
  const selectedIds = computed(() => uniqueItemIds(props.modelValue))
  const selectedItems = computed(() => selectedIds.value.map(id => cache.value[id] || {
    id, typeId: props.itemTypeId, name: `Запись #${id}`, data: {},
  }))

  function remember(rows) {
    for (const item of rows) cache.value[item.id] = item
  }

  async function hydrate() {
    const version = ++hydrationRequest
    hydrationError.value = ''
    const missing = selectedIds.value.filter(id => !cache.value[id])
    if (!missing.length) return
    try {
      const response = await itemsApi.byIds(missing)
      if (disposed || version !== hydrationRequest) return
      remember(response?.items || [])
      if (selectedIds.value.some(id => !cache.value[id])) hydrationError.value = 'Некоторые записи недоступны. Выбор сохранён.'
    } catch {
      if (!disposed && version === hydrationRequest) hydrationError.value = 'Не удалось загрузить выбранные записи. Выбор сохранён.'
    }
  }

  async function load(more = false) {
    const version = ++request
    const offset = more ? items.value.length : 0
    if (!more) items.value = []
    loading.value = true
    error.value = ''
    const query = search.value.trim()
    const path = query ? `/items/search?q=${encodeURIComponent(query)}&` : '/items?'
    try {
      const response = await fetchGet(`${path}typeId=${props.itemTypeId}&limit=${PAGE_SIZE}&offset=${offset}`)
      if (version !== request || disposed) return
      const page = response?.items || []
      remember(page)
      items.value = more ? [...items.value, ...page] : page
      hasMore.value = page.length === PAGE_SIZE
    } catch {
      if (version === request && !disposed) error.value = 'Не удалось загрузить список.'
    } finally {
      if (version === request && !disposed) loading.value = false
    }
  }

  function begin() {
    clearTimeout(timer)
    draft.value = [...selectedIds.value]
    search.value = ''
    open.value = true
    hydrate()
    load()
  }

  function close() {
    open.value = false
    clearTimeout(timer)
    request++
  }

  function apply() {
    emit('update:modelValue', [...draft.value])
    close()
  }

  watch(search, () => {
    clearTimeout(timer)
    if (!open.value) return
    request++
    items.value = []
    loading.value = true
    timer = setTimeout(() => load(), 200)
  }, { flush: 'sync' })
  watch(selectedIds, hydrate, { immediate: true })
  onScopeDispose(() => { disposed = true; clearTimeout(timer); request++ })

  return {
    open, search, draft, items, selectedItems, loading, error, hydrationError, hasMore,
    begin, close, apply, hydrate,
    updateItem: item => remember([item]),
    toggle: id => { draft.value = toggleItemId(draft.value, id) },
    remove: id => emit('update:modelValue', selectedIds.value.filter(value => value !== Number(id))),
    loadMore: () => { if (!loading.value) return load(true) },
    retry: () => load(items.value.length > 0),
  }
}
