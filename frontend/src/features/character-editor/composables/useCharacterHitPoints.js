import { computed } from 'vue'
import { collectCharacterHpBonuses } from '@/features/character-editor/lib/characterHitPoints'

export function useCharacterHitPoints(values, itemsById) {
  const bonuses = computed(() => collectCharacterHpBonuses(values.value, itemsById.value))
  return { bonuses }
}

