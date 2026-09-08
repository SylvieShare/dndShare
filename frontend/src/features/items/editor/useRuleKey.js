import { computed, ref, watch } from 'vue'
import { uniqueRuleKey } from './actionEditorModel'

export function useRuleKey(props, emit) {
  // An explicitly empty saved key is a manual choice, distinct from a missing key.
  const manual = ref(props.modelValue != null)
  const generatedKey = computed(() => uniqueRuleKey(props.title, props.usedKeys))
  watch(() => props.title, () => {
    if (!manual.value) emit('update:modelValue', generatedKey.value)
  }, { immediate: true, flush: 'sync' })
  function setManually(value) { manual.value = true; emit('update:modelValue', value) }
  return { manual, generatedKey, setManually }
}
