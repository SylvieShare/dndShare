import { ref } from 'vue'
import { armorAbilityRollEffects, resolveRollMode } from '@/features/character-editor/blocks/dnd/lib/rollMode'

/**
 * Shared roll-effect collector. Contributors return advantage/disadvantage
 * rows for a roll context; opposite modes are resolved only after collection.
 */
export function useCharacterRollEffects(characterArmor, contributors = []) {
  const registered = ref([...contributors])

  function register(contributor) {
    if (typeof contributor !== 'function') return () => {}
    registered.value = [...registered.value, contributor]
    return () => { registered.value = registered.value.filter(row => row !== contributor) }
  }

  function effects(context = {}, extraEffects = []) {
    const armorState = characterArmor.state?.value || characterArmor.state || {}
    return [
      ...armorAbilityRollEffects(armorState, context.abilitySuggestId),
      ...registered.value.flatMap(contributor => contributor(context) || []),
      ...(Array.isArray(extraEffects) ? extraEffects : []),
    ]
  }

  function resolve(manualMode, context = {}, extraEffects = []) {
    return resolveRollMode(manualMode, effects(context, extraEffects))
  }

  return { effects, resolve, register }
}
