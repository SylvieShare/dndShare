<template>
  <div ref="root" class="dd-block">
    <BaseTile class="dd-tile">
      <DndDefensesView
        :defenses="defenses"
        :damage-types="damageTypes"
        :manage="ownerMode"
        @manage="onManage"
      />
    </BaseTile>

    <MorphEditorShell
      v-if="editorOpen"
      :origin-rect="originRect"
      :origin-el="originEl"
      :strip="false"
      @close="close"
    >
      <template #view="{ revealed }">
        <DndDefensesView
          :defenses="defenses"
          :damage-types="damageTypes"
          :manage="ownerMode"
          :edit-fade="revealed"
          panel
        />
      </template>
      <template #editor>
        <DndDefensesEditor
          :defenses="manualDefenses"
          :readonly-defenses="readonlyDefenses"
          :damage-types="damageTypes"
          :damage-type-suggest-id="damageTypeSuggestId"
          @change="change"
          @remove="remove"
          @add="add"
        />
      </template>
    </MorphEditorShell>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import DndDefensesEditor from '@/features/character-editor/blocks/dnd/components/DndDefensesEditor.vue'
import DndDefensesView from '@/features/character-editor/blocks/dnd/components/DndDefensesView.vue'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell.vue'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true })
const suggestStore = useSuggestStore()
const root = ref(null)
const { editorOpen, originRect, originEl, openFrom, close } = useMorphOrigin()

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
  openFrom(root.value)
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
.dd-block, .dd-tile { min-width: 0; width: 100%; box-sizing: border-box; }
.dd-tile { display: block; }
</style>
