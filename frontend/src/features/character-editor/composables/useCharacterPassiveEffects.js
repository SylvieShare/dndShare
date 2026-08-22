import { computed } from 'vue'
import { collectCharacterPassiveEffects } from '@/features/character-editor/lib/characterPassiveEffects'

export function useCharacterPassiveEffects(values, itemsById) {
  const effects = computed(() => collectCharacterPassiveEffects(values.value, itemsById.value))
  return { effects }
}

