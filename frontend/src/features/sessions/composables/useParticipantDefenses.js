import { computed, ref, shallowRef, watch } from 'vue'
import { itemsApi } from '@/shared/api/itemsApi'
import { useSuggestStore } from '@/stores/suggest'
import { featureItemIds, inventoryEntries } from '@/features/character-editor/lib/characterMagicItems'
import { armorBaseId } from '@/features/character-editor/lib/magicArmor'
import { participantDefenses } from '../lib/participantDefenses'

export function useParticipantDefenses(participant, enabled = () => true) {
  const items = shallowRef(new Map()), loading = ref(true), error = ref(''), suggest = useSuggestStore()
  const values = computed(() => participant()?.data?.values || {})
  const stats = computed(() => participantDefenses(values.value, items.value, type => suggest.items(type), participant()?.sourceVersion || '2014'))
  const references = computed(() => JSON.stringify([
    enabled(), [...new Set([...featureItemIds(values.value), ...(values.value.states || []).map(state => state.effect_id)].filter(Boolean))].sort(),
    inventoryEntries(values.value).map(({ entry }) => [entry.magic_item_id, entry.item_id, entry.params?.base_item_id]), participant()?.sourceVersion,
  ]))
  watch(references, async (_, __, onCleanup) => {
    let cancelled = false
    onCleanup(() => { cancelled = true })
    error.value = ''
    if (!enabled()) { loading.value = false; return }
    loading.value = true
    try {
      const loaded = new Map()
      const ids = [...new Set([...featureItemIds(values.value), ...(values.value.states || []).map(state => state.effect_id)].filter(Boolean))]
      const load = async keys => {
        for (let index = 0; index < keys.length; index += 100) {
          const result = await itemsApi.byIds(keys.slice(index, index + 100))
          for (const item of result.items || []) loaded.set(String(item.id), item)
        }
      }
      await suggest.ensure(3)
      await load(ids)
      const bases = inventoryEntries(values.value).map(({ entry }) => armorBaseId(loaded.get(String(entry.magic_item_id ?? entry.item_id)), entry)).filter(id => id && !loaded.has(String(id)))
      await load([...new Set(bases)])
      if (!cancelled) items.value = loaded
    } catch (cause) { if (!cancelled) error.value = cause.message || 'Не удалось рассчитать показатели.' }
    finally { if (!cancelled) loading.value = false }
  }, { immediate: true })
  return { stats, loading, error }
}
