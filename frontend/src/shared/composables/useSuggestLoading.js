import { onScopeDispose, ref, toValue, watch } from 'vue'
import { useSuggestStore } from '@/stores/suggest'

// Shared by desktop and mobile dictionary pickers; never treat an unfinished request as an empty list.
export function useSuggestLoading(typeId) {
  const store = useSuggestStore()
  const loading = ref(false)
  const error = ref('')
  let version = 0

  async function reload() {
    const current = ++version
    const id = toValue(typeId)
    error.value = ''
    loading.value = Boolean(id && id !== '__local__' && !store.loaded(id))
    if (!loading.value) return
    try {
      await store.ensure(id)
    } catch {
      if (current === version) error.value = 'Не удалось загрузить варианты.'
    } finally {
      if (current === version) loading.value = false
    }
  }

  watch(() => toValue(typeId), reload, { immediate: true })
  onScopeDispose(() => { version += 1 })
  return { loading, error, reload }
}
