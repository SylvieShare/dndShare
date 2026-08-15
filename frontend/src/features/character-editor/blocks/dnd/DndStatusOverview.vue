<template>
  <div ref="root" class="dso-root">
    <BaseTile
      class="dso-tile"
      :color="summaryColor"
      :strip="hasActiveSummary"
      :interactive="canInteract"
      @click="openSection('states')"
    >
      <DndStatusOverviewView
        :active-items="activeItems"
        :exhaustion-level="exhaustionLevel"
        :inspiration-active="inspirationActive"
        :editable="canInteract"
        @select="openSection"
        @show-tooltip="showStatusTooltip"
        @hide-tooltip="hideStatusTooltip"
      />
    </BaseTile>
  </div>

  <MorphEditorShell
    v-if="editorOpen"
    :origin-rect="originRect"
    :origin-el="originEl"
    :color="summaryColor"
    :strip="hasActiveSummary"
    orientation="vertical"
    :min-view-width="360"
    @close="closeEditor"
  >
    <template #view>
      <DndStatusOverviewView
        :active-items="activeItems"
        :exhaustion-level="exhaustionLevel"
        :inspiration-active="inspirationActive"
        @show-tooltip="showStatusTooltip"
        @hide-tooltip="hideStatusTooltip"
      />
    </template>

    <template #editor>
      <div class="dso-editor">
        <div class="dso-tabs" role="tablist" aria-label="Редактирование статусов">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="dso-tab"
            :class="{ 'dso-tab--active': editorKind === tab.id }"
            type="button"
            role="tab"
            :aria-selected="editorKind === tab.id"
            @click="editorKind = tab.id"
          >
            <component :is="tab.icon" :size="16" :stroke-width="1.8" aria-hidden="true" />
            <span>{{ tab.label }}</span>
            <span v-if="tab.value" class="dso-tab-value" :class="`dso-tab-value--${tab.id}`">{{ tab.value }}</span>
          </button>
        </div>

        <BlockStatesPickerEditor
          v-if="editorKind === 'states'"
          :suggest-type-id="suggestTypeId"
          :items="allItems"
          :active-ids="activeIds"
          title="Состояния"
          @toggle="toggleState"
          @created="onStateCreated"
        />
        <DndExhaustionEditor
          v-else-if="editorKind === 'exhaustion'"
          :value="exhaustionValue"
          @change="setExhaustion"
        />
        <DndInspirationEditor
          v-else
          :value="inspirationValue"
          @change="setInspiration"
        />
      </div>
    </template>
  </MorphEditorShell>

  <ItemTooltip
    v-if="tooltip.visible"
    :title="tooltip.title"
    :desc="tooltip.desc"
    :x="tooltip.x"
    :top="tooltip.top"
    :bottom="tooltip.bottom"
  />
</template>

<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { Activity, BatteryLow, Sparkles } from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'
import BlockStatesPickerEditor from '@/features/character-editor/blocks/generic/components/BlockStatesPickerEditor'
import DndExhaustionEditor from '@/features/character-editor/blocks/dnd/components/DndExhaustionEditor'
import DndInspirationEditor from '@/features/character-editor/blocks/dnd/components/DndInspirationEditor'
import DndStatusOverviewView from '@/features/character-editor/blocks/dnd/components/DndStatusOverviewView'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'
import { normalizeExhaustion } from '@/features/character-editor/blocks/dnd/lib/exhaustion'
import { isInspirationActive } from '@/features/character-editor/blocks/dnd/lib/mobileStatus'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  block: { type: Object, required: true },
  values: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true })
const suggestStore = useSuggestStore()
const root = ref(null)
const editorKind = ref('states')
const tooltip = ref({ visible: false, title: '', desc: '', x: 0, top: null, bottom: null })
const { editorOpen, originRect, originEl, openFrom, close } = useMorphOrigin()

const ids = computed(() => ({
  states: props.block.content?.states_id || 'states',
  exhaustion: props.block.content?.exhaustion_id || 'exhaustion',
  inspiration: props.block.content?.inspiration_id || 'inspiration',
}))
const suggestTypeId = computed(() => props.block.content?.states_suggest_id || 9)
const activeIds = computed(() => Array.isArray(props.values?.[ids.value.states]) ? props.values[ids.value.states] : [])
const allItems = computed(() => suggestStore.items(suggestTypeId.value))
const activeItems = computed(() => allItems.value.filter(item => activeIds.value.includes(item.id)))
const exhaustionValue = computed(() => props.values?.[ids.value.exhaustion] || { level: 0 })
const exhaustionLevel = computed(() => normalizeExhaustion(exhaustionValue.value).level)
const inspirationValue = computed(() => props.values?.[ids.value.inspiration] ?? false)
const inspirationActive = computed(() => isInspirationActive(inspirationValue.value))
const hasActiveSummary = computed(() => activeItems.value.length > 0 || exhaustionLevel.value > 0 || inspirationActive.value)
const canInteract = computed(() => !!charCtx.ownerMode)
const summaryColor = computed(() => {
  if (exhaustionLevel.value > 0) return 'var(--danger)'
  if (inspirationActive.value) return 'var(--accent)'
  return activeItems.value[0]?.color || 'var(--accent)'
})
const tabs = computed(() => [
  { id: 'states', label: 'Состояния', icon: Activity, value: activeIds.value.length || '' },
  { id: 'exhaustion', label: 'Истощение', icon: BatteryLow, value: exhaustionLevel.value || '' },
  { id: 'inspiration', label: 'Вдохновение', icon: Sparkles, value: inspirationActive.value ? '✦' : '' },
])

onMounted(() => {
  suggestStore.ensure(suggestTypeId.value)
})

function updateValue(id, value) {
  emit('update:value', id, value)
}

function openSection(kind) {
  if (!canInteract.value) return
  editorKind.value = kind
  hideStatusTooltip()
  openFrom(root.value?.querySelector('.dso-tile'))
}

function closeEditor() {
  hideStatusTooltip()
  close()
}

function toggleState(id) {
  const next = activeIds.value.includes(id)
    ? activeIds.value.filter(value => value !== id)
    : [...activeIds.value, id]
  updateValue(ids.value.states, next)
}

function onStateCreated(item) {
  suggestStore.addItem(suggestTypeId.value, item)
}

function setExhaustion(value) {
  updateValue(ids.value.exhaustion, value)
}

function setInspiration(value) {
  updateValue(ids.value.inspiration, value)
}

function showStatusTooltip(event, item) {
  if (!item.desc) return
  const rect = event.currentTarget.getBoundingClientRect()
  const above = window.innerHeight - rect.bottom < 180
  tooltip.value = {
    visible: true,
    title: item.value,
    desc: item.desc,
    x: Math.max(8, Math.min(rect.left, window.innerWidth - 380)),
    top: above ? null : rect.bottom + 8,
    bottom: above ? window.innerHeight - rect.top + 8 : null,
  }
}

function hideStatusTooltip() {
  tooltip.value.visible = false
}
</script>

<style scoped>
.dso-root { min-width: 0; }
.dso-tile { overflow: hidden; }
.dso-editor { border-top: 1px solid var(--border); background: var(--bg); }
.dso-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.dso-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 0;
  min-height: 34px;
  padding: 0 7px;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s, color 0.12s;
}
.dso-tab span:not(.dso-tab-value) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dso-tab--active { border-color: color-mix(in srgb, var(--accent) 35%, var(--border)); background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--text-1); }
.dso-tab-value { flex: 0 0 auto; color: var(--text-muted); font-size: 10px; }
.dso-tab-value--exhaustion { color: var(--danger); }
.dso-tab-value--inspiration { color: var(--accent-soft); }
</style>
