import { computed, watch } from 'vue'
import {
  activeBackgroundChoices,
  backgroundChoiceProfile,
  backgroundChoicesComplete,
  backgroundStartingEquipment,
  backgroundToolProficiencySelections,
  backgroundToolItems as resolveBackgroundToolItems,
} from '@/features/character-editor/settings/dnd/creation/backgroundEquipment'

export function useDndCreateBackground(state, equipment, paused) {
  // Changing background clears choices that belong to the previous background.
  watch(() => state.background?.id, () => {
    if (paused()) return
    state.bgLangIds = []
    state.backgroundItemChoices = {}
    state.backgroundAsi = {}
    state.originFeatId = null; state.originFeatChoices = {}; state.backgroundTakeGold = false
  })

  const backgroundItemChoiceProfile = computed(() => backgroundChoiceProfile(
    state.background,
    equipment.equipmentCatalogue.value,
  ))
  const activeBackgroundItemChoices = computed(() => activeBackgroundChoices(
    backgroundItemChoiceProfile.value,
    state.version === '2024' ? !state.backgroundTakeGold : !state.buyStartingEquipment,
  ))
  const backgroundReferencesAvailable = computed(() => {
    if (state.version !== '2024' || state.backgroundTakeGold) return true
    const available = new Set(equipment.equipmentCatalogue.value.map(item => Number(item.id)))
    return (state.background?.data?.equipment_items || []).every(row => available.has(Number(row.item_id)))
  })
  const backgroundItemChoicesComplete = computed(() => backgroundReferencesAvailable.value && backgroundChoicesComplete(
    backgroundItemChoiceProfile.value,
    state.backgroundItemChoices,
    { includeEquipment: state.version === '2024' ? !state.backgroundTakeGold : !state.buyStartingEquipment },
  ))
  const selectedBackgroundToolProficiencies = computed(() => backgroundToolProficiencySelections(
    backgroundItemChoiceProfile.value,
    state.backgroundItemChoices,
  ))
  function setBackgroundItemChoice(key, itemId) {
    state.backgroundItemChoices = { ...state.backgroundItemChoices, [key]: itemId }
  }

  const backgroundStart = computed(() => state.version === '2024' && state.backgroundTakeGold ? { items: [], coins: { 3: Number(state.background?.data?.starting_gold) || 50 } } : backgroundStartingEquipment(
    state.background,
    equipment.equipmentCatalogue.value,
    state.backgroundItemChoices,
  ))
  const backgroundToolItems = computed(() => resolveBackgroundToolItems(
    state.background,
    equipment.equipmentCatalogue.value,
    state.backgroundItemChoices,
  ))
  return { backgroundItemChoiceProfile, activeBackgroundItemChoices, backgroundItemChoicesComplete,
    selectedBackgroundToolProficiencies, setBackgroundItemChoice, backgroundStart, backgroundToolItems }
}
