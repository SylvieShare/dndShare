import { ref, watch } from 'vue'
import { uniqueRuleKey } from './actionEditorModel'

export function useRuleKey(props, emit) {
  // An explicitly empty saved key is a manual choice, distinct from a missing key.
  const manual = ref(props.modelValue != null)
  watch(() => props.title, title => {
    if (!manual.value) emit('update:modelValue', uniqueRuleKey(title, props.usedKeys))
  }, { immediate: true, flush: 'sync' })
  function setManually(value) { manual.value = true; emit('update:modelValue', value) }
  return { manual, setManually }
}
