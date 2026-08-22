<template>
  <div ref="root" class="da-block">
    <BaseTile class="da-tile">
      <DndActionsView
        :groups="groups"
        :manage="ownerMode"
        @manage="onManage"
        @use="useAction"
      />
    </BaseTile>

    <MorphEditorShell
      v-if="editorOpen"
      :origin-rect="originRect"
      :origin-el="originEl"
      :strip="false"
      :min-view-width="320"
      @close="close"
    >
      <template #view="{ revealed }">
        <DndActionsView
          :groups="groups"
          :manage="ownerMode"
          :edit-fade="revealed"
          panel
          @use="useAction"
        />
      </template>
      <template #editor>
        <DndActionsEditor
          :manual-actions="manualActions"
          :readonly-actions="readonlyActions"
          @add="addAction"
          @change="changeAction"
          @remove="removeAction"
        />
      </template>
    </MorphEditorShell>
  </div>
</template>

<script setup>
import { computed, inject, ref, watch } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import DndActionsEditor from '@/features/character-editor/blocks/dnd/components/DndActionsEditor.vue'
import DndActionsView from '@/features/character-editor/blocks/dnd/components/DndActionsView.vue'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell.vue'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'
import { collectCharacterFeatureActions, groupCharacterFeatureActions } from '@/features/character-editor/lib/characterFeatureActions'
import { makeUid } from '@/features/character-editor/blocks/dnd/lib/itemEntry'

const props = defineProps(['block', 'value', 'values'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: false })
const setBlockHidden = inject('setBlockHidden', () => {})
const root = ref(null)
const { editorOpen, originRect, originEl, openFrom, close } = useMorphOrigin()

const ownerMode = computed(() => !!charCtx.ownerMode)
const manualActions = computed(() => Array.isArray(props.value) ? props.value : [])
const itemsById = computed(() => charCtx.characterResources?.itemsById?.value || charCtx.characterResources?.itemsById || new Map())
const resources = computed(() => charCtx.characterResources?.resources?.value || charCtx.characterResources?.resources || [])
const actions = computed(() => collectCharacterFeatureActions(props.values || {}, itemsById.value, resources.value))
const readonlyActions = computed(() => actions.value.filter(action => action.readonly))
const groups = computed(() => groupCharacterFeatureActions(actions.value))

watch([() => actions.value.length, ownerMode], ([length, canManage]) => setBlockHidden(!length && !canManage), { immediate: true })

function emitActions(next) {
  emit('update:value', props.block.id, next)
}

function onManage() {
  openFrom(root.value)
}

function addAction() {
  emitActions([...manualActions.value, {
    uid: makeUid('action'),
    title: 'Новое действие',
    action_type: 'action',
    description: '',
    requirements: [],
  }])
}

function changeAction(uid, patch) {
  emitActions(manualActions.value.map(action => action.uid === uid ? { ...action, ...patch } : action))
}

function removeAction(uid) {
  emitActions(manualActions.value.filter(action => action.uid !== uid))
}

function useAction(action) {
  if (!ownerMode.value) return
  const cost = Math.max(1, Number(action.resource_cost) || 1)
  if (action.resource && !action.resource.unlimited) {
    if (Number(action.resource.value) < cost) return
    const patch = charCtx.characterResources?.setAvailable?.(action.resource.key, Number(action.resource.value) - cost) || {}
    if (Object.keys(patch).length) charCtx.updateValues?.(patch)
  }
  charCtx.logSessionEvent?.({
    type: 'feature_action',
    action: action.title,
    data: { actionType: action.action_type, source: action.source_label || null },
  })
}
</script>

<style scoped>
.da-block, .da-tile { width: 100%; min-width: 0; box-sizing: border-box; }
.da-tile { display: block; }
</style>
