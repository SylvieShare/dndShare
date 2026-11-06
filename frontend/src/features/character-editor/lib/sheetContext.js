import { computed, provide } from 'vue'

export const characterSheetContext = Symbol('character-sheet')

export function provideSheetFields(definition, data, updateValue, updateVar) {
  provide(characterSheetContext, { definition, values: computed(() => data.value.values), vars: computed(() => data.value.var), updateValue, updateVar })
}
