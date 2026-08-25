<template>
  <div ref="root" class="da-block">
    <BaseTile class="da-tile">
      <DndActionsView
        :groups="groups"
        :manage="ownerMode"
        :action-suggestions="actionSuggestions"
        @manage="openEditor"
        @edit="editAction"
        @move="moveAction"
        @remove="removeAction"
        @apply-effect="applyActionEffect"
      />
    </BaseTile>

    <MorphEditorShell
      v-if="editorOpen"
      :origin-rect="originRect"
      :origin-el="originEl"
      :strip="false"
      :min-view-width="320"
      @close="closeEditor"
    >
      <template #view="{ revealed }">
        <DndActionsView
          :groups="groups"
          :manage="ownerMode"
          :edit-fade="revealed"
          :action-suggestions="actionSuggestions"
          panel
          @apply-effect="applyActionEffect"
        />
      </template>
      <template #editor>
        <DndActionsEditor
          :actions="manualActions"
          :readonly-actions="readonlyActions"
          :selected-uid="editingUid"
          @add="addAction"
          @change="changeAction"
          @remove="removeAction"
        />
      </template>
    </MorphEditorShell>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import DndActionsEditor from '@/features/character-editor/blocks/dnd/components/DndActionsEditor.vue'
import DndActionsView from '@/features/character-editor/blocks/dnd/components/DndActionsView.vue'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell.vue'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'
import { collectCharacterFeatureActions, featureActionEffectPatch, groupCharacterFeatureActions } from '@/features/character-editor/lib/characterFeatureActions'
import { makeUid } from '@/features/character-editor/blocks/dnd/lib/itemEntry'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps(['block', 'value', 'values'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: false })
const setBlockHidden = inject('setBlockHidden', () => {})
const suggestStore = useSuggestStore()
const root = ref(null)
const editingUid = ref(null)
const { editorOpen, originRect, originEl, openFrom, close } = useMorphOrigin()

const ownerMode = computed(() => !!charCtx.ownerMode)
const manualActions = computed(() => Array.isArray(props.value) ? props.value : [])
const itemsById = computed(() => charCtx.characterResources?.itemsById?.value || charCtx.characterResources?.itemsById || new Map())
const resources = computed(() => charCtx.characterResources?.resources?.value || charCtx.characterResources?.resources || [])
const actions = computed(() => collectCharacterFeatureActions(props.values || {}, itemsById.value, resources.value))
const groups = computed(() => groupCharacterFeatureActions(actions.value))
const readonlyActions = computed(() => actions.value.filter(action => action.readonly))
const actionSuggestions = computed(() => suggestStore.items(24) || [])

watch([() => actions.value.length, ownerMode], ([length, canManage]) => setBlockHidden(!length && !canManage), { immediate: true })

function emitActions(next) {
  emit('update:value', props.block.id, next)
}

function emitOrder(next) {
  emit('update:value', 'action_order', next)
}

function openEditor() {
  editingUid.value = null
  openFrom(root.value)
}

function addAction() {
  const uid = makeUid('action')
  editingUid.value = uid
  emitActions([...manualActions.value, {
    uid,
    title: 'Новое действие',
    action_type: 'action',
    description: '',
    requirements: [],
  }])
}

function editAction(action) {
  if (action.readonly) return
  editingUid.value = action.uid
  openFrom(root.value)
}

function changeAction(uid, patch) {
  emitActions(manualActions.value.map(action => action.uid === uid ? { ...action, ...patch } : action))
}

function moveAction(action, direction) {
  const group = actions.value.filter(entry => entry.action_type === action.action_type)
  const index = group.findIndex(entry => entry.key === action.key)
  const target = index + direction
  if (index < 0 || target < 0 || target >= group.length) return
  const reordered = [...group]
  ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
  const groupKeys = new Set(group.map(entry => entry.key))
  const next = actions.value.map(entry => entry.key).filter(key => !groupKeys.has(key))
  const insertAt = actions.value.findIndex(entry => entry.action_type === action.action_type)
  next.splice(insertAt, 0, ...reordered.map(entry => entry.key))
  emitOrder(next)
}

function removeAction(action) {
  if (action.readonly) return
  emitActions(manualActions.value.filter(entry => entry.uid !== action.uid))
  emitOrder((props.values?.action_order || []).filter(key => key !== action.key))
  if (editingUid.value === action.uid) editingUid.value = null
}

function applyActionEffect(action, effect) {
  if (!ownerMode.value) return
  const patch = featureActionEffectPatch(props.values || {}, effect)
  if (!patch) return
  for (const [id, value] of Object.entries(patch)) emit('update:value', id, value)
  charCtx.logSessionEvent?.({
    type: 'feature_action_effect',
    action: `${action.title}: ${effect.title}`,
    data: { actionKey: action.key, effectKey: effect.key },
  })
}

function closeEditor() {
  close()
  editingUid.value = null
}

onMounted(() => suggestStore.ensure(24))
</script>

<style scoped>
.da-block, .da-tile { width: 100%; min-width: 0; box-sizing: border-box; }
.da-tile { display: block; }
</style>
