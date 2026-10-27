<template>
  <div class="character-sheet" :class="'character-sheet--' + format">
    <template v-if="definition?.system === 'dnd5e'">
      <DndDesktopBody v-if="format === 'desktop'" :section="section" @select-tab="emit('select-tab', $event)" />
      <DndSection v-else :section="section" :format="format" />
    </template>
    <VtmSheet v-else-if="definition?.system === 'vtm-v20'" :section="section" :format="format" />
  </div>
</template>

<script setup>
import { computed, provide } from 'vue'
import { characterSheetContext } from '../lib/sheetContext'
import DndDesktopBody from './sheet/DndDesktopBody.vue'
import DndSection from './sheet/DndSection.vue'
import VtmSheet from './sheet/VtmSheet.vue'

const props = defineProps({
  definition: Object,
  format: { type: String, default: 'desktop' },
  section: String,
  values: { type: Object, default: () => ({}) },
  vars: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:value', 'update:var', 'select-tab'])
provide(characterSheetContext, {
  definition: computed(() => props.definition),
  values: computed(() => props.values),
  vars: computed(() => props.vars),
  updateValue: patch => emit('update:value', patch),
  updateVar: patch => emit('update:var', patch),
})
</script>
<style src="./sheet/sheetLayout.css"></style>
