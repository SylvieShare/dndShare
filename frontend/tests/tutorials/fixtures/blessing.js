import { ref } from 'vue'
import { useCharacterDerivedEffects } from '../../../src/features/character-editor/composables/useCharacterDerivedEffects'
export function blessingEffects() {
  return useCharacterDerivedEffects(ref({ states: [{ uid: 'bless', effect_id: 4656 }] }), ref(new Map([['4656', {
    id: 4656, name: 'Благословение', typeId: 15,
    data: { derived_effects: [{ kind: 'roll_bonus', formula: '1d4', scopes: ['attack', 'saving_throw'] }] },
  }]])))
}
