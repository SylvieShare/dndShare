<template>
  <div class="input-desc">
    <div v-if="block.title || showToggle" class="desc-head">
      <span v-if="block.title" class="desc-title">{{ block.title }}</span>
      <button
        v-if="showToggle && !editOn"
        class="field-edit-btn"
        type="button"
        title="Редактировать"
        @click="editOn = true"
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
      <button v-else-if="showToggle" class="desc-done-btn" type="button" @click="editOn = false">Готово</button>
    </div>

    <div :class="{ 'desc-body--owner': showToggle && !editing }" @click="showToggle && !editing && (editOn = true)">
      <RichTextEditor
        ref="editorRef"
        :model-value="value"
        :editable="editing"
        :placeholder="block.content?.placeholder ?? 'Текст...'"
        :labels="RUSSIAN_LABELS"
        @update:model-value="$emit('update:value', block.id, $event)"
        @node-select="selectNode"
      >
        <template #toolbar>
          <button type="button" class="rich-tool-btn" title="Вставить формулу броска" @mousedown.prevent="openCreate('dice')">◇</button>
          <button type="button" class="rich-tool-btn" title="Вставить ссылку на предмет" @mousedown.prevent="openCreate('item')">◫</button>
          <button type="button" class="rich-tool-btn" title="Вставить ссылку на справочник" @mousedown.prevent="openCreate('suggest')">◆</button>
        </template>
        <template #node="{ node }"><DndRichInlineNode :node="node" /></template>
      </RichTextEditor>
    </div>

    <BasePopover
      :open="Boolean(selectedNode)"
      :anchor="selectedNode?.element"
      :min-width="210"
      :z-index="4550"
      @update:open="value => { if (!value) selectedNode = null }"
    >
      <div v-if="selectedNode" class="rich-node-menu">
        <span class="rich-node-menu-label">{{ nodeTypeLabel(selectedNode.node.kind) }}</span>
        <strong>{{ selectedNode.node.label }}</strong>
        <div class="rich-node-menu-actions">
          <button type="button" @click="editSelectedNode">{{ selectedNode.node.kind === 'item' ? 'Заменить' : 'Изменить' }}</button>
          <button type="button" class="danger" @click="removeSelectedNode">Удалить</button>
        </div>
      </div>
    </BasePopover>

    <RichDiceNodeModal
      v-if="activeEditor === 'dice'"
      :node="editingTarget?.node || null"
      @close="closeNodeEditor"
      @save="saveNode"
      @remove="removeEditingNode"
    />
    <RichSuggestNodeModal
      v-if="activeEditor === 'suggest'"
      :node="editingTarget?.node || null"
      @close="closeNodeEditor"
      @save="saveNode"
      @remove="removeEditingNode"
    />
    <ItemPickerModal
      v-if="activeEditor === 'item' && itemTypeIds.length"
      :item-type-ids="itemTypeIds"
      title="Ссылка на предмет"
      search-placeholder="Найти предмет…"
      :z-index="4600"
      @close="closeNodeEditor"
      @pick="pickItem"
    />
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { BasePopover, RichTextEditor } from '@sylvieshare/share-ui'
import { useItemTypesStore } from '@/stores/itemTypes'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import RichDiceNodeModal from '@/shared/ui/RichDiceNodeModal.vue'
import RichSuggestNodeModal from '@/shared/ui/RichSuggestNodeModal.vue'
import DndRichInlineNode from '@/shared/ui/DndRichInlineNode.vue'

const RUSSIAN_LABELS = {
  toolbar: 'Форматирование текста',
  bold: 'Жирный',
  boldShort: 'Ж',
  italic: 'Курсив',
  italicShort: 'К',
  underline: 'Подчёркнутый',
  underlineShort: 'П',
  paragraph: 'Абзац',
  normal: 'Обычный текст',
  heading: 'Заголовок {level}',
  color: 'Цвет текста',
  colorShort: 'А',
  clearColor: 'Сбросить цвет',
  link: 'Вставить ссылку',
  linkText: 'Текст ссылки',
  linkTextPlaceholder: 'Как ссылка выглядит в тексте',
  linkUrl: 'Адрес',
  linkInvalid: 'Введите безопасный адрес ссылки',
  saveLink: 'Применить',
  removeLink: 'Убрать ссылку',
  cancel: 'Отмена',
}

const props = defineProps({
  block: { type: Object, default: () => ({}) },
  value: { type: String, default: '' },
  editable: { type: Boolean, default: false },
})
defineEmits(['update:value'])

const charCtx = inject('charCtx', { ownerMode: true })
const owner = computed(() => Boolean(charCtx.ownerMode))
const showToggle = computed(() => owner.value && !props.editable)
const editOn = ref(false)
const editing = computed(() => props.editable || (owner.value && editOn.value))
const editorRef = ref(null)
const selectedNode = ref(null)
const editingTarget = ref(null)
const activeEditor = ref('')
const itemTypeIds = ref([])

function nodeTypeLabel(kind) {
  return ({ dice: 'Формула броска', item: 'Ссылка на предмет', suggest: 'Ссылка на справочник' })[kind] || 'Встроенный элемент'
}

function selectNode(selection) {
  if (!editing.value || !selection?.node) return
  selectedNode.value = selection
}

async function openCreate(kind) {
  editorRef.value?.rememberSelection?.()
  editingTarget.value = null
  selectedNode.value = null
  activeEditor.value = kind
  if (kind === 'item' && !itemTypeIds.value.length) {
    const types = await useItemTypesStore().ensureAll().catch(() => [])
    itemTypeIds.value = types.map(type => type.id)
  }
}

async function editSelectedNode() {
  if (!selectedNode.value) return
  editingTarget.value = selectedNode.value
  activeEditor.value = selectedNode.value.node.kind
  selectedNode.value = null
  if (activeEditor.value === 'item' && !itemTypeIds.value.length) {
    const types = await useItemTypesStore().ensureAll().catch(() => [])
    itemTypeIds.value = types.map(type => type.id)
  }
  if (activeEditor.value === 'item') {
    const currentTypeId = Number(editingTarget.value.node.payload?.typeId)
    itemTypeIds.value = [currentTypeId, ...itemTypeIds.value.filter(id => Number(id) !== currentTypeId)]
      .filter(Number.isFinite)
  }
}

function closeNodeEditor() {
  activeEditor.value = ''
  editingTarget.value = null
}

function saveNode(node) {
  if (editingTarget.value) editorRef.value?.updateRichNode?.(editingTarget.value.element, node)
  else editorRef.value?.insertRichNode?.(node)
  closeNodeEditor()
}

function pickItem(item) {
  saveNode({
    kind: 'item',
    payload: { id: Number(item.id), typeId: Number(item.typeId) },
    label: item.name,
  })
}

function removeSelectedNode() {
  if (!selectedNode.value) return
  editorRef.value?.removeRichNode?.(selectedNode.value.element)
  selectedNode.value = null
}

function removeEditingNode() {
  if (editingTarget.value) editorRef.value?.removeRichNode?.(editingTarget.value.element)
  closeNodeEditor()
}

</script>

<style scoped>
.input-desc { display: flex; flex-direction: column; }
.input-desc :deep(.desc-editor),
.input-desc :deep(.desc-view) {
  font-family: var(--font-prose);
  font-optical-sizing: auto;
}
.desc-head { display: flex; align-items: center; gap: 8px; min-height: 24px; margin-bottom: 4px; }

.desc-title {
  min-width: 0;
  overflow: hidden;
  color: var(--text-2);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.desc-head .field-edit-btn,
.desc-head .desc-done-btn { margin-left: auto; }

.field-edit-btn {
  display: grid;
  width: 24px;
  height: 24px;
  padding: 0;
  background: none;
  border: none;
  border-radius: var(--r-sm);
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0.35;
  place-items: center;
  transition: color 0.15s, opacity 0.15s;
}

@media (hover: hover) {
  .input-desc:hover .field-edit-btn { color: var(--accent); opacity: 1; }
}

.field-edit-btn:focus-visible { color: var(--accent); opacity: 1; }

.desc-done-btn {
  padding: 3px 8px;
  background: none;
  border: none;
  border-radius: var(--r-sm);
  color: var(--accent);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.12s;
}

.desc-done-btn:hover { background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); }
.desc-body--owner { cursor: text; }

.rich-tool-btn {
  display: grid;
  min-width: 26px;
  height: 26px;
  padding: 0 5px;
  border: 0;
  border-radius: var(--r-sm);
  background: none;
  color: var(--text-muted);
  font: 700 13px/1 var(--font-ui);
  cursor: pointer;
  place-items: center;
}
.rich-tool-btn:hover { background: var(--surface-raised); color: var(--accent-soft); }
.rich-node-menu { display: flex; flex-direction: column; gap: 5px; max-width: 280px; }
.rich-node-menu-label { color: var(--text-muted); font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.rich-node-menu strong { overflow: hidden; color: var(--text-1); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.rich-node-menu-actions { display: flex; gap: 6px; margin-top: 3px; }
.rich-node-menu-actions button { padding: 5px 8px; border: 0; border-radius: var(--r-sm); background: var(--surface-raised); color: var(--text-2); font: inherit; font-size: 11px; cursor: pointer; }
.rich-node-menu-actions button:hover { color: var(--text-1); }
.rich-node-menu-actions button.danger { margin-left: auto; color: var(--danger); }
</style>
