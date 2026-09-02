<template>
  <div ref="root" class="da-block">
    <BaseTile class="da-tile">
      <DndActionsView
        :groups="groups"
        :manage="ownerMode"
        :action-suggestions="actionSuggestions"
        @manage="openEditor"
        @edit="editAction"
        @remove="removeAction"
        @apply-effect="applyActionEffect"
        @spend-resource="spendActionResource"
        @activate-target="openTargetPicker"
        @toggle-resource="toggleActionResource"
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
          @spend-resource="spendActionResource"
          @activate-target="openTargetPicker"
          @toggle-resource="toggleActionResource"
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

    <CharacterEntryPickerModal
      v-if="targetAction"
      :title="targetAction.title"
      subtitle="Выберите оружие"
      :entries="targetEntries"
      empty-text="У персонажа нет оружия."
      @select="activateTargetAction"
      @close="closeTargetPicker"
    />
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import DndActionsEditor from '@/features/character-editor/blocks/dnd/components/DndActionsEditor.vue'
import DndActionsView from '@/features/character-editor/blocks/dnd/components/DndActionsView.vue'
import CharacterEntryPickerModal from '@/features/character-editor/components/CharacterEntryPickerModal.vue'
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
const targetAction = ref(null)
const targetLoading = ref(false)
const { editorOpen, originRect, originEl, openFrom, close } = useMorphOrigin()

const ownerMode = computed(() => !!charCtx.ownerMode)
const manualActions = computed(() => Array.isArray(props.value) ? props.value : [])
const itemsById = computed(() => charCtx.characterResources?.itemsById?.value || charCtx.characterResources?.itemsById || new Map())
const resources = computed(() => charCtx.characterResources?.resources?.value || charCtx.characterResources?.resources || [])
const actions = computed(() => collectCharacterFeatureActions(props.values || {}, itemsById.value, resources.value))
const groups = computed(() => groupCharacterFeatureActions(actions.value))
const readonlyActions = computed(() => actions.value.filter(action => action.readonly))
const actionSuggestions = computed(() => suggestStore.items(24) || [])
const targetEffect = computed(() => targetAction.value
  ? charCtx.characterStatuses?.itemByCode?.(targetAction.value.status_effect_code) || null
  : null)
const targetEntries = computed(() => {
  const action = targetAction.value
  if (!action || action.target_kind !== 'weapon') return []
  const parameter = action.target_parameter || 'weapon_uid'
  return (Array.isArray(props.values?.weapon) ? props.values.weapon : []).map((entry, index) => {
    const item = itemsById.value.get(String(entry.item_id)) || null
    const active = !!targetEffect.value && !!charCtx.characterStatuses?.activeByParam?.(
      targetEffect.value,
      parameter,
      entry.uid,
    )
    const magicBonus = Math.max(0, Number(entry.params?.magic_bonus) || 0)
    return {
      key: entry.uid || `${entry.item_id}-${index}`,
      value: entry,
      item,
      title: item?.name || `Оружие #${entry.item_id || index + 1}`,
      subtitle: magicBonus > 0 ? `Магический бонус +${magicBonus}` : '',
      note: active ? 'Эффект уже действует' : targetLoading.value ? 'Загрузка эффекта…' : '',
      disabled: targetLoading.value || !targetEffect.value || active,
    }
  })
})

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

function spendActionResource(action) {
  if (!ownerMode.value || !action.resource || action.resource_cost <= 0) return
  const remaining = Number(action.resource.value) - action.resource_cost
  if (remaining < 0) return
  const patch = charCtx.characterResources?.setAvailable?.(action.resource.key, remaining) || {}
  for (const [id, value] of Object.entries(patch)) emit('update:value', id, value)
  if (!Object.keys(patch).length) return
  charCtx.logSessionEvent?.({
    type: 'feature_action_resource',
    action: `${action.title}: потрачен ресурс «${action.resource.title}»`,
    data: { actionKey: action.key, resourceKey: action.resource.key, cost: action.resource_cost },
  })
}

async function openTargetPicker(action) {
  if (!ownerMode.value || !action?.target_kind) return
  targetAction.value = action
  targetLoading.value = true
  const targetItemIds = action.target_kind === 'weapon'
    ? (props.values?.weapon || []).map(entry => entry.item_id).filter(id => id != null)
    : []
  await Promise.all([
    charCtx.characterResources?.ensureItems?.(targetItemIds),
    charCtx.characterStatuses?.ensureCatalog?.(),
  ])
  targetLoading.value = false
}

function closeTargetPicker() {
  targetAction.value = null
  targetLoading.value = false
}

function activateTargetAction(target) {
  const action = targetAction.value
  const effect = targetEffect.value
  if (!ownerMode.value || !action || !effect || typeof charCtx.updateValues !== 'function') return
  const parameter = action.target_parameter || 'weapon_uid'
  if (!target?.uid || charCtx.characterStatuses?.activeByParam?.(effect, parameter, target.uid)) return
  const cost = Math.max(0, Number(action.resource_cost) || 0)
  const patch = {}
  if (cost > 0) {
    if (!action.resource) return
    const remaining = Number(action.resource.value) - cost
    if (remaining < 0) return
    Object.assign(patch, charCtx.characterResources?.setAvailable?.(action.resource.key, remaining) || {})
    if (!Object.keys(patch).length) return
  }
  const item = itemsById.value.get(String(target.item_id)) || null
  patch.states = charCtx.characterStatuses.add(effect, {
    source: {
      kind: 'feature_action',
      item_id: action.item?.id ?? null,
      label: action.title,
    },
    params: {
      [parameter]: target.uid,
      target_name: item?.name || `Оружие #${target.item_id || ''}`,
    },
  })
  charCtx.updateValues(patch)
  charCtx.logSessionEvent?.({
    type: 'feature_action_effect',
    action: `${action.title}: ${item?.name || 'оружие'}`,
    data: {
      actionKey: action.key,
      targetKind: action.target_kind,
      targetUid: target.uid,
      targetItemId: target.item_id,
      resourceKey: action.resource?.key || null,
      cost,
    },
  })
  closeTargetPicker()
}

function toggleActionResource(action, pip) {
  if (!ownerMode.value || !action.resource) return
  const current = Number(action.resource.value) || 0
  const next = pip <= current ? pip - 1 : pip
  const patch = charCtx.characterResources?.setAvailable?.(action.resource.key, next) || {}
  for (const [id, value] of Object.entries(patch)) emit('update:value', id, value)
  if (!Object.keys(patch).length || next >= current) return
  charCtx.logSessionEvent?.({
    type: 'resource_used',
    action: `Использовано: ${action.resource.title || action.title || 'Ресурс'}`,
    data: { remaining: next, total: Number(action.resource.total) || 0 },
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
