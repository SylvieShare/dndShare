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
        :exhaustion-effects="exhaustionEffects"
        :inspiration-active="inspirationActive"
        :editable="canInteract"
        @select="openSection"
        @add-effect="pickerOpen = true"
        @add-inspiration="setInspiration(true)"
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
        :exhaustion-effects="exhaustionEffects"
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

        <CharacterStatusEditor
          v-if="editorKind === 'states'"
          :statuses="statuses"
          @add="pickerOpen = true"
          @remove="removeStatus"
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

  <ItemPickerModal
    v-if="pickerOpen"
    :item-type-ids="[effectItemTypeId]"
    title="Эффекты и состояния"
    search-placeholder="Поиск эффекта..."
    :z-index="3400"
    @close="pickerOpen = false"
    @pick="addStatus"
  />

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
import { computed, inject, ref } from 'vue'
import { Activity, BatteryLow, Sparkles } from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'
import CharacterStatusEditor from '@/features/character-editor/blocks/dnd/components/CharacterStatusEditor.vue'
import DndExhaustionEditor from '@/features/character-editor/blocks/dnd/components/DndExhaustionEditor'
import DndInspirationEditor from '@/features/character-editor/blocks/dnd/components/DndInspirationEditor'
import DndStatusOverviewView from '@/features/character-editor/blocks/dnd/components/DndStatusOverviewView'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'
import { normalizeExhaustion } from '@/features/character-editor/blocks/dnd/lib/exhaustion'
import { isInspirationActive } from '@/features/character-editor/blocks/dnd/lib/mobileStatus'

const props = defineProps({
  block: { type: Object, required: true },
  values: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true })
const root = ref(null)
const editorKind = ref('states')
const pickerOpen = ref(false)
const tooltip = ref({ visible: false, title: '', desc: '', x: 0, top: null, bottom: null })
const { editorOpen, originRect, originEl, openFrom, close } = useMorphOrigin()

const ids = computed(() => ({
  states: props.block.content?.states_id || 'states',
  exhaustion: props.block.content?.exhaustion_id || 'exhaustion',
  inspiration: props.block.content?.inspiration_id || 'inspiration',
}))
const effectItemTypeId = computed(() => Number(props.block.content?.effect_item_type_id) || 15)
const statuses = computed(() => {
  const value = charCtx.characterStatuses?.entries
  return Array.isArray(value) ? value : Array.isArray(value?.value) ? value.value : []
})
const activeItems = computed(() => statuses.value.map(status => ({
  id: status.uid,
  value: status.title,
  desc: status.description,
  color: status.color,
  svg: status.item?.svg || '',
  polarity: status.polarity,
})))
const exhaustionValue = computed(() => props.values?.[ids.value.exhaustion] || { level: 0 })
const normalizedExhaustion = computed(() => normalizeExhaustion(exhaustionValue.value))
const exhaustionLevel = computed(() => normalizedExhaustion.value.level)
const exhaustionEffects = computed(() => normalizedExhaustion.value.effects.slice(0, exhaustionLevel.value))
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
  { id: 'states', label: 'Эффекты', icon: Activity, value: statuses.value.length || '' },
  { id: 'exhaustion', label: 'Истощение', icon: BatteryLow, value: exhaustionLevel.value || '' },
  { id: 'inspiration', label: 'Вдохновение', icon: Sparkles, value: inspirationActive.value ? '✦' : '' },
])

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

function addStatus(item) {
  pickerOpen.value = false
  charCtx.characterResources?.rememberItems?.([item])
  updateValue(ids.value.states, charCtx.characterStatuses?.addManual?.(item) || [])
}

function removeStatus(uid) {
  updateValue(ids.value.states, charCtx.characterStatuses?.remove?.(uid) || [])
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
