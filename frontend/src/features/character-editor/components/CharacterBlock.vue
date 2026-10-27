<template>
  <div v-if="component" v-show="visible" class="character-sheet-field" :data-sheet-field="definition.id" :style="placementStyle">
    <component :is="component" v-bind="componentProps" @update:value="updateValue" @update:var="updateVar" />
  </div>
</template>

<script setup>
import { computed, inject, provide, ref } from 'vue'
import { BLOCK_REGISTRY } from '../blocks/blockRegistry'
import { characterSheetContext } from '../lib/sheetContext'

const props = defineProps({
  blockId: String,
  block: Object,
  values: Object,
  vars: Object,
  options: { type: Object, default: () => ({}) },
  contentOptions: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:value', 'update:var'])
const context = inject(characterSheetContext, null)
const hidden = ref(false)
const charCtx = inject('charCtx', { ownerMode: false })
const visible = computed(() => !hidden.value && !(definition.value.type === 'CHARACTER_READ_ONLY' && charCtx.ownerMode))
provide('setBlockHidden', value => { hidden.value = value })
const values = computed(() => props.values ?? context?.values.value ?? {})
const vars = computed(() => props.vars ?? context?.vars.value ?? {})
const definition = computed(() => {
  const field = props.block ?? context?.definition.value?.blocks?.[props.blockId]
  if (!field) return {}
  return { ...field, props: { ...field.props, ...props.options },
    content: { ...field.content, ...props.contentOptions } }
})
const registration = computed(() => BLOCK_REGISTRY[definition.value.type])
const component = computed(() => registration.value?.component)
const placementStyle = computed(() => {
  const placement = definition.value.props || {}
  return { width: placement.width, height: placement.height, minWidth: placement['min-width'],
    ...placement.style }
})
const componentProps = computed(() => {
  const reg = registration.value
  if (!reg) return {}
  const block = definition.value
  const result = { block }
  if (!reg.noValue) {
    const stored = values.value[block.id]
    result.value = reg.noValuePreset ? stored : stored ?? block.preset
    if (block.type === 'DND_CHAR_STAT_10') {
      result.value = { value: 10, save_up: false,
        skills_up: Array(block.content?.list?.length ?? 0).fill(0), ...stored }
    }
  }
  if (reg.passValues || reg.passValuesOnly) result.values = values.value
  if (reg.passValues) result.vars = vars.value
  return result
})
function updateValue(idOrPatch, value) {
  const patch = typeof idOrPatch === 'object' && idOrPatch !== null && 'id' in idOrPatch
    ? idOrPatch : { id: idOrPatch, value }
  if (context) context.updateValue(patch)
  else emit('update:value', patch)
}
function updateVar(patch) {
  if (context) context.updateVar(patch)
  else emit('update:var', patch)
}
</script>
<style scoped>
.character-sheet-field { min-width: 0; }
</style>
