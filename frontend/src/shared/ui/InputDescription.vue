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

    <div ref="transitionBody" class="desc-transition" :class="{ 'desc-body--owner': showToggle && !editing }" @click="showToggle && !editing && (editOn = true)">
      <RichTextEditor
        ref="editorRef"
        :model-value="value"
        :editable="editing"
        :aria-label="block.title || block.content?.label"
        :placeholder="block.content?.placeholder ?? 'Текст...'"
        :labels="RUSSIAN_LABELS"
        :show-link-button="false"
        @update:model-value="$emit('update:value', block.id, $event)"
        @node-select="selectNode"
      >
        <template #toolbar>
          <span class="rich-insert-actions">
            <button
              type="button"
              class="rich-tool-btn"
              title="Вставить ссылку"
              aria-label="Вставить ссылку"
              @mousedown.prevent="openLink($event.currentTarget)"
            >
              <Link2 :size="16" :stroke-width="1.8" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="rich-tool-btn"
              title="Вставить формулу броска"
              aria-label="Вставить формулу броска"
              @mousedown.prevent="openCreate('dice')"
            >
              <Dices :size="16" :stroke-width="1.8" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="rich-tool-btn"
              title="Вставить расчёт"
              aria-label="Вставить расчёт"
              @mousedown.prevent="openCreate('calculation')"
            >
              <Calculator :size="16" :stroke-width="1.8" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="rich-tool-btn"
              title="Вставить ссылку на предмет"
              aria-label="Вставить ссылку на предмет"
              @mousedown.prevent="openCreate('item')"
            >
              <PackageSearch :size="16" :stroke-width="1.8" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="rich-tool-btn"
              title="Вставить термин справочника"
              aria-label="Вставить термин справочника"
              @mousedown.prevent="openCreate('suggest')"
            >
              <BookOpenCheck :size="16" :stroke-width="1.8" aria-hidden="true" />
            </button>
          </span>
          <button
            ref="insertMenuTrigger"
            type="button"
            class="rich-tool-btn rich-insert-more"
            title="Вставить элемент"
            aria-label="Вставить элемент"
            aria-haspopup="menu"
            :aria-expanded="insertMenuOpen"
            @mousedown.prevent="toggleInsertMenu"
          >
            <Ellipsis :size="18" :stroke-width="2" aria-hidden="true" />
          </button>
        </template>
        <template #node="{ node }"><DndRichInlineNode :node="node" /></template>
      </RichTextEditor>
    </div>

    <BasePopover
      :open="insertMenuOpen"
      :anchor="insertMenuTrigger"
      :min-width="210"
      :z-index="4550"
      role="menu"
      aria-label="Вставить элемент"
      @update:open="insertMenuOpen = $event"
    >
      <div class="rich-insert-menu">
        <button type="button" role="menuitem" @mousedown.prevent="openLinkFromMenu">
          <Link2 :size="17" aria-hidden="true" />
          <span>Ссылка</span>
        </button>
        <button type="button" role="menuitem" @mousedown.prevent="openCreateFromMenu('dice')">
          <Dices :size="17" aria-hidden="true" />
          <span>Формула броска</span>
        </button>
        <button type="button" role="menuitem" @mousedown.prevent="openCreateFromMenu('item')">
          <PackageSearch :size="17" aria-hidden="true" />
          <span>Ссылка на предмет</span>
        </button>
        <button type="button" role="menuitem" @mousedown.prevent="openCreateFromMenu('calculation')">
          <Calculator :size="17" aria-hidden="true" />
          <span>Расчёт</span>
        </button>
        <button type="button" role="menuitem" @mousedown.prevent="openCreateFromMenu('suggest')">
          <BookOpenCheck :size="17" aria-hidden="true" />
          <span>Термин справочника</span>
        </button>
        <button type="button" role="menuitem" @mousedown.prevent="insertStat('ac')">
          <Shield :size="17" aria-hidden="true" />
          <span>Класс доспеха</span>
        </button>
        <button type="button" role="menuitem" @mousedown.prevent="insertStat('hp')">
          <HeartPulse :size="17" aria-hidden="true" />
          <span>Хиты</span>
        </button>
      </div>
    </BasePopover>

    <BasePopover
      :open="Boolean(selectedNode)"
      :anchor="selectedNode?.element"
      :min-width="210"
      :z-index="4550"
      :close-on-scroll="false"
      :close-on-resize="false"
      @update:open="value => { if (!value) selectedNode = null }"
    >
      <div v-if="selectedNode" class="rich-node-menu">
        <span class="rich-node-menu-label">{{ nodeTypeLabel(selectedNode.node.kind) }}</span>
        <strong>{{ selectedNode.node.label }}</strong>
        <div class="rich-node-menu-actions">
          <button v-if="selectedNode.node.kind !== 'stat'" type="button" @mousedown.prevent @click="editSelectedNode">{{ selectedNode.node.kind === 'item' ? 'Заменить' : 'Изменить' }}</button>
          <button type="button" class="danger" @mousedown.prevent @click="removeSelectedNode">Удалить</button>
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
    <RichCalculationNodeModal
      v-if="activeEditor === 'calculation'"
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
import { useDescriptionTransition } from '@/shared/lib/useDescriptionTransition'
import { BasePopover, RichTextEditor } from '@sylvieshare/share-ui'
import { BookOpenCheck, Calculator, Dices, Ellipsis, HeartPulse, Link2, PackageSearch, Shield } from '@lucide/vue'
import { useItemTypesStore } from '@/stores/itemTypes'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import RichDiceNodeModal from '@/shared/ui/RichDiceNodeModal.vue'
import RichSuggestNodeModal from '@/shared/ui/RichSuggestNodeModal.vue'
import RichCalculationNodeModal from '@/shared/ui/RichCalculationNodeModal.vue'
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
const transitionBody = ref(null)
useDescriptionTransition(transitionBody, editing)
const editorRef = ref(null)
const selectedNode = ref(null)
const editingTarget = ref(null)
const activeEditor = ref('')
const itemTypeIds = ref([])
const insertMenuTrigger = ref(null)
const insertMenuOpen = ref(false)

function nodeTypeLabel(kind) {
  return ({ dice: 'Формула броска', calculation: 'Расчёт', item: 'Ссылка на предмет', suggest: 'Термин справочника', stat: 'Игровой показатель' })[kind] || 'Встроенный элемент'
}

function selectNode(selection) {
  if (!editing.value || !selection?.node) return
  selectedNode.value = selection
}

async function openCreate(kind, rememberSelection = true) {
  if (rememberSelection) editorRef.value?.rememberSelection?.()
  editingTarget.value = null
  selectedNode.value = null
  activeEditor.value = kind
  if (kind === 'item' && !itemTypeIds.value.length) {
    const types = await useItemTypesStore().ensureAll().catch(() => [])
    itemTypeIds.value = types.map(type => type.id)
  }
}

function toggleInsertMenu() {
  editorRef.value?.rememberSelection?.()
  insertMenuOpen.value = !insertMenuOpen.value
}

function openCreateFromMenu(kind) {
  insertMenuOpen.value = false
  openCreate(kind, false)
}

function insertStat(stat) {
  insertMenuOpen.value = false
  editorRef.value?.insertRichNode?.({
    kind: 'stat',
    payload: { stat },
    label: stat === 'ac' ? 'КД' : 'хиты',
  })
}

function openLink(anchor) {
  insertMenuOpen.value = false
  editorRef.value?.openLinkEditor?.(anchor)
}

function openLinkFromMenu() {
  openLink(insertMenuTrigger.value)
}

async function editSelectedNode() {
  if (!selectedNode.value) return
  editingTarget.value = selectedNode.value
  const target = selectedNode.value
  selectedNode.value = null
  activeEditor.value = target.node.kind
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

<style scoped src="./input-description.css" />
