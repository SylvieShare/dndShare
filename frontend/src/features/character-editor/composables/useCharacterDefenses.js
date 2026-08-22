import { computed } from 'vue'

import {
  collectCharacterDefenses,
  DND_CHARACTER_DEFENSE_SOURCES,
} from '@/features/character-editor/lib/characterDefenses'

export function useCharacterDefenses(values, itemsById, sources = DND_CHARACTER_DEFENSE_SOURCES) {
  const defenses = computed(() => collectCharacterDefenses(
    values.value,
    itemsById.value,
    sources,
  ))

  return { defenses }
}
