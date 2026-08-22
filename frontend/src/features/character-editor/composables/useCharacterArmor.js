import { computed, watch } from 'vue'
import { useSuggestStore } from '@/stores/suggest'
import { normalizeValue } from '@/features/character-editor/blocks/dnd/lib/itemSection'
import { deriveEquippedArmor } from '@/features/character-editor/blocks/dnd/lib/equippedArmor'

export function useCharacterArmor(values, characterResources) {
  const suggest = useSuggestStore()
  const equippedIds = computed(() => normalizeValue(values.value?.items).equipped
    .map(entry => entry.item_id)
    .filter(id => id != null))

  async function hydrate() {
    await Promise.all([
      characterResources.ensureItems(equippedIds.value),
      suggest.ensure(3),
    ])
  }

  watch(() => equippedIds.value.map(String).join(','), hydrate, { immediate: true })

  const state = computed(() => deriveEquippedArmor(
    values.value,
    characterResources.itemsById?.value || new Map(),
    typeId => suggest.items(typeId),
  ))

  return { state, hydrate }
}
