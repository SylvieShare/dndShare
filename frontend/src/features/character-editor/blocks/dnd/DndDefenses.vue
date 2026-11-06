<template>
  <DndDefensesView v-bind="$attrs" class="dd-block"
    :defenses="defenses"
    :damage-types="damageTypes"
    :manage="ownerMode"
    @manage="onManage"
  />

  <AppModalFrame v-if="editorOpen" title="Защиты" :width="540" :z-index="3100" @close="editorOpen = false">
    <DndDefensesEditor
      :defenses="manualDefenses"
      :readonly-defenses="readonlyDefenses"
      :damage-types="damageTypes"
      :damage-type-suggest-id="damageTypeSuggestId"
      @change="change"
      @remove="remove"
      @add="add"
    />
  </AppModalFrame>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import DndDefensesEditor from '@/features/character-editor/blocks/dnd/components/DndDefensesEditor.vue'
import DndDefensesView from '@/features/character-editor/blocks/dnd/components/DndDefensesView.vue'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { useSuggestStore } from '@/stores/suggest'

defineOptions({ inheritAttrs: false })
const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true })
const suggestStore = useSuggestStore()
const editorOpen = ref(false)

const damageTypeSuggestId = computed(() => Number(props.block.content?.damage_type_suggest_id) || 12)
suggestStore.ensure(damageTypeSuggestId.value)

const damageTypes = computed(() => suggestStore.items(damageTypeSuggestId.value) || [])
const manualDefenses = computed(() => Array.isArray(props.value) ? props.value : [])
const defenses = computed(() => {
  const contributed = charCtx.characterDefenses?.defenses
  if (Array.isArray(contributed)) return contributed
  if (Array.isArray(contributed?.value)) return contributed.value
  return manualDefenses.value
})
const readonlyDefenses = computed(() => defenses.value.filter((entry) => entry.readonly))
const ownerMode = computed(() => !!charCtx.ownerMode)

function emitDefenses(next) {
  emit('update:value', props.block.id, next)
}

function onManage() {
  editorOpen.value = true
}

function change(index, patch) {
  emitDefenses(manualDefenses.value.map((entry, rowIndex) => rowIndex === index ? { ...entry, ...patch } : entry))
}

function remove(index) {
  emitDefenses(manualDefenses.value.filter((_, rowIndex) => rowIndex !== index))
}

function add() {
  emitDefenses([...manualDefenses.value, { damage_type: null, kind: 'resistance' }])
}
</script>

<style scoped>
.dd-block { width: 100%; min-width: 0; box-sizing: border-box; }
</style>
