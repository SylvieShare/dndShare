<template>
  <div class="dmsm">
    <div v-if="hasActiveSummary" class="dmsm-active" aria-label="Активные статусы">
      <div class="dmsm-active-inner">
        <span
          v-for="item in activeItems"
          :key="item.id"
          class="dmsm-status"
          :style="{ '--status-color': item.color || 'var(--text-muted)' }"
          :title="item.value"
          :aria-label="item.value"
        >
          <SvgIcon v-if="item.svg" class="dmsm-status-icon" :svg="item.svg" :color="item.color || '#888888'" filter />
          <span v-else class="dmsm-status-dot"></span>
        </span>
        <span v-if="exhaustionLevel > 0" class="dmsm-badge dmsm-badge--exhaustion" :title="`Истощение: ${exhaustionLevel}`">
          Истощение {{ exhaustionLevel }}
        </span>
        <span v-if="inspirationActive" class="dmsm-badge dmsm-badge--inspiration" title="Вдохновение">
          <span aria-hidden="true">✦</span> Вдохновение
        </span>
      </div>
    </div>

    <RowActionMenu v-if="canInteract" title="Статусы">
      <template #trigger="{ open }">
        <button class="dmsm-trigger" :class="{ 'dmsm-trigger--open': open }" type="button" :aria-expanded="open">
          Статусы
          <span class="dmsm-chevron" aria-hidden="true"></span>
        </button>
      </template>
      <template #default="{ close }">
        <button class="ram-item dmsm-menu-item" type="button" @click="openEditor('states', close)">
          <span>Статусы</span>
          <span v-if="activeIds.length" class="dmsm-menu-value">{{ activeIds.length }}</span>
        </button>
        <button class="ram-item dmsm-menu-item" type="button" @click="openEditor('exhaustion', close)">
          <span>Истощение</span>
          <span v-if="exhaustionLevel > 0" class="dmsm-menu-value dmsm-menu-value--danger">{{ exhaustionLevel }}</span>
        </button>
        <button class="ram-item dmsm-menu-item" type="button" @click="openEditor('inspiration', close)">
          <span>Вдохновение</span>
          <span v-if="inspirationActive" class="dmsm-menu-value dmsm-menu-value--accent">✦</span>
        </button>
      </template>
    </RowActionMenu>

    <AppModalFrame v-if="editorKind === 'states'" title="Статусы" :padded="false" @close="closeEditor">
      <BlockStatesPickerEditor
        :suggest-type-id="suggestTypeId"
        :items="allItems"
        :active-ids="activeIds"
        title="Активные статусы"
        @toggle="toggleState"
        @created="onStateCreated"
      />
    </AppModalFrame>

    <AppModalFrame v-if="editorKind === 'exhaustion'" title="Истощение" :padded="false" @close="closeEditor">
      <DndExhaustionEditor :value="exhaustionValue" embedded @change="setExhaustion" />
    </AppModalFrame>

    <AppModalFrame v-if="editorKind === 'inspiration'" title="Вдохновение" :padded="false" @close="closeEditor">
      <EditorPanel>
        <button
          class="dmsm-inspiration-toggle"
          :class="{ 'dmsm-inspiration-toggle--active': inspirationActive }"
          type="button"
          :aria-pressed="inspirationActive"
          @click="setInspiration(!inspirationActive)"
        >
          <span class="dmsm-inspiration-mark" aria-hidden="true">✦</span>
          <span class="dmsm-inspiration-copy">
            <strong>{{ inspirationActive ? 'Вдохновение есть' : 'Нет вдохновения' }}</strong>
            <span>{{ inspirationActive ? 'Нажмите, чтобы потратить' : 'Нажмите, чтобы выдать' }}</span>
          </span>
        </button>
        <p class="dmsm-inspiration-note">Героическое вдохновение выдаёт мастер игры; его можно потратить, чтобы перебросить кубик.</p>
      </EditorPanel>
    </AppModalFrame>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import AppModalFrame from '@/shared/ui/AppModalFrame'
import BlockStatesPickerEditor from '@/features/character-editor/blocks/generic/components/BlockStatesPickerEditor'
import DndExhaustionEditor from '@/features/character-editor/blocks/dnd/components/DndExhaustionEditor'
import EditorPanel from '@/features/character-editor/components/EditorPanel'
import RowActionMenu from '@/shared/ui/RowActionMenu'
import SvgIcon from '@/shared/ui/SvgIcon'
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
const editorKind = ref(null)

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
const inspirationActive = computed(() => isInspirationActive(props.values?.[ids.value.inspiration]))
const hasActiveSummary = computed(() => activeItems.value.length > 0 || exhaustionLevel.value > 0 || inspirationActive.value)
const canInteract = computed(() => !!charCtx.ownerMode)

onMounted(() => {
  suggestStore.ensure(suggestTypeId.value)
})

function updateValue(id, value) {
  emit('update:value', id, value)
}
function openEditor(kind, closeMenu) {
  closeMenu()
  editorKind.value = kind
}
function closeEditor() {
  editorKind.value = null
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
</script>

<style scoped>
.dmsm {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  min-width: 0;
  min-height: 40px;
}
.dmsm-active {
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.dmsm-active::-webkit-scrollbar { display: none; }
.dmsm-active-inner {
  display: flex;
  align-items: center;
  gap: 6px;
  width: max-content;
  min-width: min-content;
  margin-left: auto;
}
.dmsm-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  border-radius: 6px;
  background: color-mix(in srgb, var(--status-color) 9%, transparent);
}
.dmsm-status-icon { width: 22px; height: 22px; display: inline-flex; }
.dmsm-status-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--status-color); }
.dmsm-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex: 0 0 auto;
  height: 24px;
  box-sizing: border-box;
  padding: 0 7px;
  border-radius: 7px;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}
.dmsm-badge--exhaustion { color: var(--danger); background: color-mix(in srgb, var(--danger) 11%, transparent); }
.dmsm-badge--inspiration { color: var(--accent-soft); background: color-mix(in srgb, var(--accent) 13%, transparent); }
.dmsm-trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-on-accent) 3%, transparent);
  color: var(--text-2);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  white-space: nowrap;
}
.dmsm :deep(.ram-custom-trigger) { flex: 0 0 auto; }
.dmsm-trigger--open { border-color: var(--accent); color: var(--text-1); background: color-mix(in srgb, var(--accent) 9%, transparent); }
.dmsm-chevron {
  width: 6px;
  height: 6px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: translateY(-2px) rotate(45deg);
  transition: transform 0.14s ease;
}
.dmsm-trigger--open .dmsm-chevron { transform: translateY(2px) rotate(225deg); }
.dmsm-menu-item { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.dmsm-menu-value { color: var(--text-muted); font-size: 11px; }
.dmsm-menu-value--danger { color: var(--danger); }
.dmsm-menu-value--accent { color: var(--accent-soft); }
.dmsm-inspiration-toggle {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 72px;
  padding: 13px 15px;
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--text-on-accent) 3%, transparent);
  color: var(--text-muted);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.dmsm-inspiration-toggle--active {
  border-color: color-mix(in srgb, var(--accent) 72%, var(--border-strong));
  background: color-mix(in srgb, var(--accent) 13%, transparent);
  color: var(--accent-soft);
}
.dmsm-inspiration-mark { flex: 0 0 auto; font-size: 28px; line-height: 1; }
.dmsm-inspiration-copy { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.dmsm-inspiration-copy strong { color: var(--text-1); font-size: 14px; }
.dmsm-inspiration-copy span { font-size: 12px; }
.dmsm-inspiration-note { margin: 0; color: var(--text-muted); font-size: 12px; line-height: 1.5; }
</style>
