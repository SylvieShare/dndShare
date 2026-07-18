<template>
  <div
    class="scene-item"
    :class="{
      'scene-item--editing': editing,
      'scene-item--placeholder': isSource,
    }"
  >
    <span class="scene-item-color-strip" :style="{ background: stripColor }" />

    <div class="scene-item-head">
      <div
        v-if="isDm"
        class="scene-item-drag"
        @pointerdown="$emit('drag-start', $event)"
      >
        <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
          <circle cx="2" cy="2" r="1"/><circle cx="6" cy="2" r="1"/>
          <circle cx="2" cy="7" r="1"/><circle cx="6" cy="7" r="1"/>
          <circle cx="2" cy="12" r="1"/><circle cx="6" cy="12" r="1"/>
        </svg>
      </div>

      <div class="scene-item-type-icon" :style="{ color: currentColor || 'var(--accent)' }">
        <svg v-if="item.type === 'list'" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="2" cy="3.5" r="1.2" fill="currentColor"/>
          <rect x="5" y="2.8" width="8" height="1.4" rx="0.7" fill="currentColor"/>
          <circle cx="2" cy="7" r="1.2" fill="currentColor"/>
          <rect x="5" y="6.3" width="8" height="1.4" rx="0.7" fill="currentColor"/>
          <circle cx="2" cy="10.5" r="1.2" fill="currentColor"/>
          <rect x="5" y="9.8" width="8" height="1.4" rx="0.7" fill="currentColor"/>
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="2" width="12" height="1.5" rx="0.75" fill="currentColor"/>
          <rect x="1" y="5.5" width="10" height="1.5" rx="0.75" fill="currentColor"/>
          <rect x="1" y="9" width="12" height="1.5" rx="0.75" fill="currentColor"/>
        </svg>
      </div>

      <input
        v-if="editing"
        ref="titleInputEl"
        v-model="draft.title"
        class="scene-item-title scene-item-title--input"
        type="text"
        maxlength="200"
        placeholder="Название плитки"
      />
      <h4 v-else class="scene-item-title">{{ item.title || typeLabel }}</h4>

      <RowActionMenu v-if="isDm">
        <template #default="{ close }">
          <button v-if="!editing" type="button" class="ram-item" @click="enterEdit(); close()">Редактировать</button>
          <div class="ram-label">Цвет</div>
          <div class="ram-colors">
            <ColorPresetPicker inline allow-clear :model-value="currentColor || ''" @update:model-value="setColor" />
          </div>
          <button type="button" class="ram-item ram-item--danger" @click="onDelete(); close()">Удалить плитку</button>
        </template>
      </RowActionMenu>
    </div>

    <div class="scene-item-body">
      <template v-if="item.type === 'text'">
        <InputDescription
          v-if="editing"
          editable
          :block="descBlock"
          :value="draft.text"
          @update:value="onDescUpdate"
        />
        <RichContent v-else-if="item.data?.text" class="scene-item-text-view" :html="item.data.text" />
        <p v-else class="scene-item-empty">—</p>
      </template>

      <template v-else-if="item.type === 'list'">
        <div v-if="editing" class="scene-item-list">
          <div v-for="(row, i) in draft.rows" :key="i" class="scene-item-row">
            <input
              v-model="row.left"
              class="scene-item-row-left"
              :style="{ color: currentColor || 'var(--accent)' }"
              placeholder="ключ"
            />
            <input
              v-model="row.right"
              class="scene-item-row-right"
              placeholder="значение"
            />
            <button type="button" class="scene-item-row-del" @click="removeRow(i)">×</button>
          </div>
          <button type="button" class="scene-item-row-add" @click="addRow">+ строка</button>
        </div>
        <div v-else-if="viewRows.length" class="scene-item-list--view">
          <template v-for="(row, i) in viewRows" :key="i">
            <span class="scene-item-row-left-view" :style="{ color: currentColor || 'var(--accent)' }">{{ row.left }}</span>
            <span class="scene-item-row-right-view">{{ row.right }}</span>
          </template>
        </div>
        <p v-else class="scene-item-empty">—</p>
      </template>
    </div>

    <div v-if="editing" class="scene-item-edit-actions">
      <button type="button" class="scene-item-cancel-btn" @click="cancelEdit">Отмена</button>
      <button type="button" class="scene-item-save-btn" @click="saveEdit">Сохранить</button>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, provide, reactive, ref, watch } from 'vue'
import ColorPresetPicker from '@/shared/ui/ColorPresetPicker'
import InputDescription from '@/shared/ui/InputDescription.vue'
import RichContent from '@/shared/ui/RichContent'
import RowActionMenu from '@/shared/ui/RowActionMenu.vue'

const props = defineProps({
  item: { type: Object, required: true },
  isDm: { type: Boolean, default: false },
  isSource: { type: Boolean, default: false },
  startInEdit: { type: Boolean, default: false },
})
const emit = defineEmits(['update', 'delete', 'drag-start'])

const titleInputEl = ref(null)
const editing = ref(false)

function focusTitle() {
  nextTick(() => {
    titleInputEl.value?.focus?.()
    titleInputEl.value?.select?.()
  })
}

const draft = reactive({
  title: '',
  text: '',
  rows: [],
  color: null,
})

const currentColor = computed(() => editing.value ? draft.color : props.item.color)
const stripColor = computed(() => currentColor.value || 'rgba(255,255,255,0.08)')

const typeLabel = computed(() => props.item.type === 'list' ? 'список' : 'текст')

provide('charCtx', { ownerMode: false, dictionaries: {}, var: {} })

const descBlock = { id: 'scene-text', content: { placeholder: 'Расширенное описание' } }

function onDescUpdate(_id, html) {
  draft.text = html
}

const viewRows = computed(() => {
  const list = props.item.data?.rows
  return Array.isArray(list) ? list.filter(r => r && (r.left || r.right)) : []
})

function syncDraft() {
  draft.title = props.item.title || ''
  draft.text = props.item.data?.text || ''
  const rows = Array.isArray(props.item.data?.rows) ? props.item.data.rows : []
  draft.rows = rows.map(r => ({ left: r.left || '', right: r.right || '' }))
  draft.color = props.item.color ?? null
}

function enterEdit() {
  syncDraft()
  editing.value = true
  focusTitle()
}

function cancelEdit() {
  syncDraft()
  editing.value = false
}

function saveEdit() {
  const data = props.item.type === 'list'
    ? { rows: draft.rows.filter(r => (r.left ?? '') !== '' || (r.right ?? '') !== '') }
    : { text: draft.text }
  emit('update', {
    title: draft.title.trim(),
    data,
    dataChanged: true,
    color: draft.color || null,
    colorChanged: true,
  })
  editing.value = false
}

function addRow() {
  draft.rows.push({ left: '', right: '' })
}

function removeRow(idx) {
  draft.rows.splice(idx, 1)
}

function setColor(color) {
  if (editing.value) {
    draft.color = color || null
    return
  }
  emit('update', { color, colorChanged: true })
}

function onDelete() {
  emit('delete')
}

onMounted(() => {
  syncDraft()
  if (props.startInEdit) {
    editing.value = true
    focusTitle()
  }
})

watch(() => props.item, () => { if (!editing.value) syncDraft() }, { deep: true })
</script>

<style scoped>
.scene-item {
  position: relative;
  background: var(--block-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.scene-item--editing { border-color: color-mix(in srgb, var(--accent) 45%, transparent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 15%, transparent); }
.scene-item--placeholder {
  border-style: dashed;
  border-color: color-mix(in srgb, var(--accent) 50%, transparent);
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}
.scene-item--placeholder > * { visibility: hidden; }

.scene-item-color-strip {
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 0;
  width: 3px;
  border-radius: 2px;
}

.scene-item-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}

.scene-item-drag {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  color: #5a5a78;
  cursor: grab;
  touch-action: none;
  flex-shrink: 0;
}
.scene-item-drag:hover { color: var(--accent); }
.scene-item-drag:active { cursor: grabbing; }

.scene-item-type-icon {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: color 0.2s;
}

.scene-item-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.scene-item-title--input {
  background: none;
  border: none;
  font-family: inherit;
  outline: none;
  padding: 2px 0;
  border-bottom: 1px solid var(--border-strong);
}
.scene-item-title--input:focus { border-color: var(--accent); }

/* body aligned with type-icon: drag(22px) + gap(8px) = 30px offset */
.scene-item-body {
  padding-left: 30px;
}

.scene-item-text-view {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--text-1);
}

.scene-item-empty {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
}

.scene-item-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.scene-item-row {
  display: grid;
  grid-template-columns: minmax(0, 0.45fr) minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}
.scene-item-row-left,
.scene-item-row-right {
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 6px 10px;
  font-family: inherit;
  font-size: 13px;
  outline: none;
  min-width: 0;
}
.scene-item-row-left { font-weight: 700; }
.scene-item-row-right { color: var(--text-1); }
.scene-item-row-left:focus,
.scene-item-row-right:focus { border-color: var(--accent); }
.scene-item-row-del {
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  border-radius: 5px;
}
.scene-item-row-del:hover { color: #e85c5c; background: rgba(232,92,92,0.1); }
.scene-item-row-add {
  margin-top: 4px;
  align-self: flex-start;
  background: none;
  border: 1px dashed var(--border-strong);
  border-radius: 7px;
  padding: 5px 12px;
  color: var(--text-muted);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.scene-item-row-add:hover { color: var(--text-1); border-color: var(--accent); }

.scene-item-list--view {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  column-gap: 12px;
  row-gap: 6px;
  align-items: baseline;
}
.scene-item-row-left-view {
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.02em;
  padding: 2px 0;
}
.scene-item-row-right-view {
  font-size: 13px;
  color: var(--text-1);
  overflow-wrap: anywhere;
  padding: 2px 0;
}

.scene-item-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
.scene-item-cancel-btn,
.scene-item-save-btn {
  padding: 7px 14px;
  border-radius: 7px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--surface-1);
  color: var(--text-1);
  transition: background 0.12s, border-color 0.12s;
}
.scene-item-cancel-btn:hover { background: var(--surface-2); }
.scene-item-save-btn {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.scene-item-save-btn:hover { background: var(--accent-dim); }
</style>
