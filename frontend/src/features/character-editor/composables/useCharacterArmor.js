import { armorBaseId } from '@/features/character-editor/lib/magicArmor'
import { computed, watch } from 'vue'
import { useSuggestStore } from '@/stores/suggest'
import { inventoryEntries } from '@/features/character-editor/lib/characterMagicItems'
import { deriveEquippedArmor } from '@/features/character-editor/blocks/dnd/lib/equippedArmor'

export function useCharacterArmor(values, characterResources, characterDerivedEffects = null) {
  const suggest = useSuggestStore()
  const equipped = computed(() => inventoryEntries(values.value).filter(row => row.equipped).map(row => row.entry))
  const equippedIds = computed(() => equipped.value
    .map(entry => entry.magic_item_id ?? entry.item_id)
    .filter(id => id != null))

  const baseIds = computed(() => equipped.value.map(entry => armorBaseId(characterResources.itemsById?.value?.get(String(entry.magic_item_id ?? entry.item_id)), entry)).filter(Boolean))
  watch(() => baseIds.value.join(','), () => characterResources.ensureItems(baseIds.value), { immediate: true })

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
    characterDerivedEffects?.armorRules?.value || { formulas: [], bonuses: [] },
    characterDerivedEffects?.grantedProficiencies?.('armor_proficiency') || [],
  ))

  return { state, hydrate }
}
