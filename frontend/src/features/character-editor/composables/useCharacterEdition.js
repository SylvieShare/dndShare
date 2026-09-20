import { computed, reactive, ref, watch } from 'vue'
import { fetchPut } from '@/shared/api/http'
import { useGameContextStore } from '@/stores/gameContext'
import { gameContextPresentation } from '@/shared/lib/gameContextPresentation'

export function useCharacterEdition({ uuid, isOwner, sourceVersionId, version, flushSave, applyCharacter, canStart = () => true }) {
  const catalogue = useGameContextStore()
  const open = ref(false)
  const busy = ref(false)
  const error = ref('')
  const source = computed(() => catalogue.sources.find(source => source.versions?.some(v => Number(v.id) === Number(sourceVersionId.value))))
  const options = computed(() => (source.value?.versions || []).map(v => ({
    id: v.id, ...gameContextPresentation(source.value, v),
    current: Number(v.id) === Number(sourceVersionId.value),
  })))
  const available = computed(() => isOwner.value && options.value.length > 1)
  watch(isOwner, owner => { if (owner) catalogue.ensure().catch(() => {}) }, { immediate: true })

  function show() {
    if (!available.value || busy.value || !canStart()) return
    error.value = ''
    open.value = true
  }
  async function change(id) {
    if (!available.value || busy.value || !canStart() || !options.value.some(v => v.id === id && !v.current)) return false
    busy.value = true
    error.value = ''
    try {
      if (!await flushSave()) throw new Error('Не удалось сохранить лист. Устраните ошибку сохранения перед сменой редакции.')
      const result = await fetchPut(`/char/${uuid}/edition`, { sourceVersionId: id, version: version.value, confirmed: true })
      applyCharacter(result)
      open.value = false
      return true
    } catch (cause) {
      error.value = cause.status === 409
        ? 'Лист изменился в другом окне. Обновите страницу перед сменой редакции.'
        : cause.message || 'Не удалось сменить редакцию'
      return false
    } finally {
      busy.value = false
    }
  }
  return reactive({ open, busy, error, options, available, show, change })
}
