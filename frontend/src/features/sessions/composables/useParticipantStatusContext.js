import { computed, reactive, ref } from 'vue'
import { charactersApi } from '@/shared/api/charactersApi'
import { useCharacterResources } from '@/features/character-editor/composables/useCharacterResources'
import { useCharacterStatuses } from '@/features/character-editor/composables/useCharacterStatuses'
import { useCharacterDerivedEffects } from '@/features/character-editor/composables/useCharacterDerivedEffects'
import { useCharacterDefenses } from '@/features/character-editor/composables/useCharacterDefenses'
import { useCharacterArmor } from '@/features/character-editor/composables/useCharacterArmor'
import { useCharacterRollEffects } from '@/features/character-editor/composables/useCharacterRollEffects'
import { statusValueProjection } from '@/features/character-editor/lib/statusValueProjection'

export function useParticipantStatusContext(participant, editable) {
  const values = computed(() => participant()?.data?.values || {})
  const versionId = computed(() => participant()?.sourceVersionId)
  const rulesVersion = () => participant()?.sourceVersion || '2014'
  const characterResources = useCharacterResources(values)
  const characterStatuses = useCharacterStatuses(values, characterResources, versionId)
  const effectiveValues = computed(() => statusValueProjection(values.value, characterResources.itemsById.value))
  const characterDerivedEffects = useCharacterDerivedEffects(effectiveValues, characterResources.itemsById, rulesVersion)
  const characterDefenses = useCharacterDefenses(values, characterResources.itemsById)
  const characterArmor = useCharacterArmor(effectiveValues, characterResources, characterDerivedEffects, rulesVersion)
  const characterRolls = useCharacterRollEffects(characterArmor, [context => characterDerivedEffects.rollEffects(context)])
  const saving = ref(false), error = ref('')
  const context = reactive({
    get ownerMode() { return !!editable() && !!participant()?.charUuid && !saving.value },
    get values() { return effectiveValues.value },
    get actor() { return { name: values.value.name || 'Персонаж', charUuid: participant()?.charUuid } },
    get rulesVersion() { return rulesVersion() },
    overlayZIndex: 9600,
    characterResources, characterStatuses, characterDerivedEffects, characterDefenses, characterArmor, characterRolls,
    updateValues,
  })

  async function updateValues(patch) {
    if (!context.ownerMode || !Object.keys(patch).length) return false
    const original = participant()
    const updates = Object.entries(patch).map(([id, value]) => ({ path: `values.${id}`, value }))
    saving.value = true
    error.value = ''
    try {
      const result = await charactersApi.patchData(original.charUuid, updates, original, { action: 'statuses' })
      const current = participant()
      if (current?.charUuid === original.charUuid && result.version >= (current.version || 0)) {
        current.data = result.data
        current.version = result.version
      }
      return true
    } catch (cause) {
      error.value = cause.message || 'Не удалось сохранить эффект.'
      return false
    } finally { saving.value = false }
  }

  return { context, statuses: characterStatuses.entries, updateValues, saving, error }
}
