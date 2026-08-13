<template>
  <div class="di-block">
    <SectionLabel v-if="block.title" :title="block.title" border>
      <template #actions>
        <button
          v-if="block.hide_button"
          class="di-collapse-btn"
          :title="contentHidden ? 'Развернуть' : 'Свернуть'"
          @click="contentHidden = !contentHidden"
        >{{ contentHidden ? '▸' : '▾' }}</button>
      </template>
    </SectionLabel>

    <template v-if="!contentHidden">
      <div v-if="loading" class="di-list-col">
        <BaseTile v-for="i in 3" :key="i" class="di-section di-skeleton-tile">
          <div class="di-skeleton"></div>
        </BaseTile>
      </div>

      <template v-else>
        <BaseTile
          v-for="section in allSections"
          :key="section.id"
          class="di-section"
          :class="{ 'di-section-locked': section.locked }"
        >
          <div class="di-section-head">
            <input
              v-if="canManage && !section.locked && renamingId === section.id"
              ref="renameInputs"
              class="di-section-rename"
              :value="section.name"
              @blur="finishRename(section.id, $event.target.value)"
              @keydown.enter.prevent="finishRename(section.id, $event.target.value)"
              @keydown.escape.prevent="renamingId = null"
            />
            <button
              v-else
              class="di-section-name"
              :class="{ 'di-section-name-editable': canManage && !section.locked }"
              :disabled="!canManage || section.locked"
              :title="canManage && !section.locked ? 'Переименовать' : ''"
              @click="canManage && !section.locked && startRename(section.id)"
            >{{ section.name }}</button>
            <span v-if="visibleItems(section).length" class="di-section-count">{{ visibleItems(section).length }}</span>
            <span class="di-section-line" aria-hidden="true"></span>
            <button
              v-if="canManage && !section.locked && model.sections.length > 1"
              class="di-section-del"
              title="Удалить секцию"
              @click="askDeleteSection(section)"
            >×</button>
          </div>

          <div
            class="di-rows"
            :data-sortable-container="sectionGroup(section.id)"
          >
            <div
              v-for="(entry, idx) in displaySectionItems(section.id)"
              :key="entry.uid"
              class="di-row"
              :class="{
                'sortable-placeholder': sortable.isSource(entry),
                'di-row-draggable': canDrag,
              }"
              :data-sortable-key="entry.uid"
              @pointerdown="onRowDown($event, entry, section.id, idx)"
              @mouseenter="e => showTooltip(e, entry)"
              @mouseleave="hideTooltip"
            >
              <InventoryItemIcon
                :svg="entry.display.svg"
                :simplified="entry.display.isCustom"
              />

              <span
                class="di-row-name"
                :class="{ 'di-row-name-editable': entry.display.isCustom && canManage }"
                :title="entry.display.isCustom && canManage ? 'Редактировать' : entry.display.name"
                @click="onNameClick(entry)"
              >
                <span class="di-row-name-text">{{ entry.display.name }}</span>
                <span v-if="entry.count > 1" class="di-count-badge">
                  <span class="di-count-x">x</span>{{ entry.count }}
                </span>
              </span>

              <div v-if="canManage" class="di-row-ctrls">
                <button
                  v-if="entry.display.consumable"
                  class="di-use-btn"
                  :title="`Использовать (осталось ${entry.count})`"
                  @click.stop="decrement(section.id, entry.uid)"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 2v9M4.5 7.5L8 11l3.5-3.5M3 13h10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>

                <button class="di-icon-btn di-del" title="Удалить" @click.stop="removeEntry(section.id, entry.uid)">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
                  </svg>
                </button>
              </div>
            </div>

            <div v-if="!visibleItems(section).length" class="di-empty">пусто</div>
          </div>

          <div v-if="canAdd" class="di-add-row">
            <button class="di-add-catalog" @click="openPicker(section.id)">+ Добавить из справочника</button>
            <button
              class="di-add-custom"
              title="Добавить предмет вручную"
              @click="openInlineForm(section.id, null)"
            >+ предмет</button>
          </div>
        </BaseTile>

        <div v-if="canManage" class="di-add-section-row">
          <button class="di-add-section" @click="addSection">+ Добавить секцию</button>
        </div>
      </template>
    </template>

    <ItemTooltip
      v-if="tooltip.visible"
      :title="tooltip.name"
      :desc="tooltip.desc"
      :x="tooltip.x"
      :top="tooltip.top"
      :bottom="tooltip.bottom"
    >
      <template v-if="tooltip.item && (tooltip.item.data?.cost || tooltip.item.data?.weight != null)" #details>
        <ItemTooltipDetails :item="tooltip.item" />
      </template>
    </ItemTooltip>

    <ItemViewModal
      v-if="modalItem"
      :item-type-id="modalItem.typeId ?? 2"
      :item-id="modalItem.id"
      :item="modalItem"
      @close="modalSelection = null"
    >
      <template v-if="canManage && modalEntry" #actions>
        <div class="di-modal-quantity">
          <span class="di-modal-quantity-label">Количество</span>
          <FormNumberInput
            :value="modalEntry.count"
            :min="1"
            :max="999"
            @change="setModalCount"
          />
        </div>
        <button type="button" class="di-modal-delete" @click="removeModalEntry">Удалить</button>
      </template>
    </ItemViewModal>

    <ItemPickerModal
      v-if="pickerOpen && pickerTypeIds.length"
      :item-type-ids="pickerTypeIds"
      title="Предметы"
      search-placeholder="Поиск предмета..."
      allow-quantity
      @close="pickerOpen = false"
      @pick="onPickerPick"
    />

    <ItemInlineFormModal
      v-if="form.open"
      :entry="form.entry"
      :base-item="form.baseItem"
      @close="form.open = false"
      @save="onInlineFormSave"
    />

    <ConfirmDialog
      v-if="confirmDel.open"
      title="Удалить секцию?"
      :message="`Секция «${confirmDel.name}» и все её предметы будут удалены.`"
      confirm-label="Удалить"
      @confirm="doDeleteSection"
      @cancel="confirmDel.open = false"
    />
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onMounted, reactive, ref, watch } from 'vue'

import BaseTile from '@/shared/ui/BaseTile'
import InventoryItemIcon from '@/features/character-editor/components/InventoryItemIcon.vue'
import ItemInlineFormModal from '@/features/character-editor/components/ItemInlineFormModal'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip'
import ItemTooltipDetails from '@/features/items/detail-components/ItemTooltipDetails'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog'
import SectionLabel from '@/shared/ui/SectionLabel'
import FormNumberInput from '@/shared/ui/form/FormNumberInput.vue'
import { itemsApi } from '@/shared/api/itemsApi'
import { useSortable } from '@/shared/composables/useSortable'
import {
  EQUIPPED_ID,
  EQUIPPED_NAME,
  allCatalogIds,
  cloneModel,
  entryDisplayData,
  makeEntryUid,
  makeSectionId,
  normalizeValue,
} from '@/features/character-editor/blocks/dnd/lib/itemSection'

const props = defineProps({ block: Object, value: { default: null } })
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', () => ({ ownerMode: false }))

const catalog = reactive({})
const loading = ref(true)
const contentHidden = ref(false)
const modalSelection = ref(null)
const pickerOpen = ref(false)
const pickerSectionId = ref(null)
const tooltip = reactive({ visible: false, name: '', desc: '', item: null, x: 0, top: null, bottom: null })
const form = reactive({ open: false, sectionId: null, entry: null, baseItem: null })
const confirmDel = reactive({ open: false, id: null, name: '' })
const renamingId = ref(null)
const renameInputs = ref([])

const model = computed(() => normalizeValue(props.value))

const allSections = computed(() => [
  { id: EQUIPPED_ID, name: EQUIPPED_NAME, items: model.value.equipped, locked: true },
  ...model.value.sections.map(s => ({ ...s, locked: false })),
])

function visibleItems(section) {
  return section.items || []
}

// Returns mutable reference to items array (equipped or sections[i].items) on a cloned model
function itemsRef(next, sectionId) {
  if (sectionId === EQUIPPED_ID) return next.equipped
  const sec = next.sections.find(s => s.id === sectionId)
  return sec ? sec.items : null
}

function setItems(next, sectionId, items) {
  if (sectionId === EQUIPPED_ID) { next.equipped = items; return }
  const sec = next.sections.find(s => s.id === sectionId)
  if (sec) sec.items = items
}

const typeIdsList = computed(() => props.block.content?.item_ids || [])
// Single mode: owners get every control (add / manage / drag); viewers see a read-only list.
const canManage = computed(() => !!charCtx.ownerMode)
const canAdd = computed(() => !!charCtx.ownerMode)
const canDrag = computed(() => !!charCtx.ownerMode)

const modalEntry = computed(() => {
  if (!modalSelection.value) return null
  return itemsRef(model.value, modalSelection.value.sectionId)
    ?.find(entry => entry.uid === modalSelection.value.uid) || null
})
const modalItem = computed(() => modalSelection.value?.id != null ? catalog[modalSelection.value.id] ?? null : null)
const pickerTypeIds = computed(() => typeIdsList.value)

function sectionGroup(id) { return 'sec_' + id }

function entryWithDisplay(entry) {
  return { ...entry, display: entryDisplayData(entry, catalog) }
}

function sectionItems(sectionId) {
  if (sectionId === EQUIPPED_ID) return model.value.equipped.map(entryWithDisplay)
  const sec = model.value.sections.find(s => s.id === sectionId)
  return sec ? sec.items.map(entryWithDisplay) : []
}

const sortable = useSortable({
  groups: new Proxy({}, {
    get(_, groupName) {
      return {
        items: { get value() { return sectionItems(parseGroup(groupName)) } },
      }
    },
    has() { return true },
    ownKeys() {
      return [sectionGroup(EQUIPPED_ID), ...model.value.sections.map(s => sectionGroup(s.id))]
    },
    getOwnPropertyDescriptor() { return { enumerable: true, configurable: true } },
  }),
  getKey: e => e.uid,
  onDrop: ({ item, fromGroup, toGroup, toIndex }) => {
    const fromSecId = parseGroup(fromGroup)
    const toSecId = parseGroup(toGroup)
    const next = cloneModel(model.value)
    const fromList = itemsRef(next, fromSecId)
    const toList = itemsRef(next, toSecId)
    if (!fromList || !toList) return
    const idx = fromList.findIndex(i => i.uid === item.uid)
    if (idx === -1) return
    const [moved] = fromList.splice(idx, 1)
    const adjustedIdx = (fromSecId === toSecId && idx < toIndex) ? toIndex - 1 : toIndex
    toList.splice(Math.min(adjustedIdx, toList.length), 0, moved)
    emit('update:value', props.block.id, next)
  },
})

function parseGroup(g) { return String(g).slice(4) }

function displaySectionItems(sectionId) {
  return sortable.displayItems(sectionGroup(sectionId))
    .map(entryWithDisplay)
}

// Whole-row drag (like spells/weapons). The sortable's 4px threshold keeps a plain tap a click; a
// drag flips `sortable.dragging` mid-gesture, which we remember so the trailing click on the name
// doesn't open the item modal.
let draggedThisGesture = false
watch(() => sortable.dragging, v => { if (v) draggedThisGesture = true })

function onRowDown(e, entry, sectionId, idx) {
  if (e.target.closest('button') || e.target.closest('input')) return
  draggedThisGesture = false
  if (!canDrag.value) return
  sortable.startDrag(e, entry, sectionGroup(sectionId), idx)
}

function emitModel(next) {
  emit('update:value', props.block.id, next)
}

function startRename(id) {
  renamingId.value = id
  nextTick(() => {
    const el = renameInputs.value?.[0]
    el?.focus()
    el?.select()
  })
}

function finishRename(id, value) {
  if (renamingId.value !== id) return
  const trimmed = (value || '').trim()
  const next = cloneModel(model.value)
  const sec = next.sections.find(s => s.id === id)
  if (sec) sec.name = trimmed || sec.name
  renamingId.value = null
  emitModel(next)
}

function addSection() {
  const next = cloneModel(model.value)
  next.sections.push({ id: makeSectionId(), name: 'Новая секция', items: [] })
  emitModel(next)
}

function askDeleteSection(section) {
  Object.assign(confirmDel, { open: true, id: section.id, name: section.name })
}

function doDeleteSection() {
  const next = cloneModel(model.value)
  next.sections = next.sections.filter(s => s.id !== confirmDel.id)
  if (next.sections.length === 0) {
    next.sections.push({ id: makeSectionId(), name: 'Рюкзак', items: [] })
  }
  confirmDel.open = false
  emitModel(next)
}

function decrement(sectionId, uid) {
  const next = cloneModel(model.value)
  const list = itemsRef(next, sectionId)
  if (!list) return
  const idx = list.findIndex(i => i.uid === uid)
  if (idx === -1) return
  const item = list[idx]
  if ((item.count || 1) > 1) item.count -= 1
  else list.splice(idx, 1)
  emitModel(next)
}

function removeEntry(sectionId, uid) {
  const next = cloneModel(model.value)
  const list = itemsRef(next, sectionId)
  if (!list) return
  setItems(next, sectionId, list.filter(i => i.uid !== uid))
  emitModel(next)
}

function setModalCount(value) {
  if (!modalSelection.value) return
  const next = cloneModel(model.value)
  const list = itemsRef(next, modalSelection.value.sectionId)
  const entry = list?.find(item => item.uid === modalSelection.value.uid)
  if (!entry) return
  entry.count = Math.max(1, Math.min(999, Math.floor(Number(value) || 1)))
  emitModel(next)
}

function removeModalEntry() {
  if (!modalSelection.value) return
  removeEntry(modalSelection.value.sectionId, modalSelection.value.uid)
  modalSelection.value = null
}

function openPicker(sectionId) {
  pickerSectionId.value = sectionId
  pickerOpen.value = true
}

function onPickerPick(item, qty = 1) {
  const n = Math.max(1, Math.min(999, Math.floor(Number(qty) || 1)))
  if (!catalog[item.id]) catalog[item.id] = item
  itemsApi.byIds([item.id]).then((response) => {
    const enriched = response?.items?.[0]
    if (enriched) catalog[item.id] = enriched
  }).catch(() => null)
  const next = cloneModel(model.value)
  const list = itemsRef(next, pickerSectionId.value) || next.sections[0]?.items
  if (!list) return
  list.push({ uid: makeEntryUid(), id: item.id, count: n, override: null })
  emitModel(next)
}

function openInlineForm(sectionId, entry) {
  const baseItem = entry?.id != null ? (catalog[entry.id] || null) : null
  Object.assign(form, { open: true, sectionId, entry, baseItem })
}

function onInlineFormSave(fields) {
  const next = cloneModel(model.value)
  const list = itemsRef(next, form.sectionId) || next.sections[0]?.items
  if (!list) return
  if (form.entry) {
    const item = list.find(i => i.uid === form.entry.uid)
    if (item) {
      const baseData = form.baseItem?.data || {}
      const baseName = form.baseItem?.name
      const ov = {}
      if (fields.name !== baseName) ov.name = fields.name
      if (fields.desc !== (baseData.desc || '')) ov.desc = fields.desc
      if (fields.consumable !== !!baseData.consumable) ov.consumable = fields.consumable
      item.override = Object.keys(ov).length ? ov : null
    }
  } else {
    list.push({
      uid: makeEntryUid(),
      id: null,
      count: 1,
      override: { name: fields.name, desc: fields.desc, consumable: fields.consumable },
    })
  }
  form.open = false
  emitModel(next)
}

function onNameClick(entry) {
  if (draggedThisGesture) { draggedThisGesture = false; return }
  if (entry.display.isCustom) {
    if (canManage.value) openInlineForm(findSectionOfEntry(entry.uid), entry)
    return
  }
  if (entry.id != null) {
    modalSelection.value = {
      sectionId: findSectionOfEntry(entry.uid),
      uid: entry.uid,
      id: entry.id,
    }
  }
}

function findSectionOfEntry(uid) {
  if (model.value.equipped.some(i => i.uid === uid)) return EQUIPPED_ID
  for (const s of model.value.sections) {
    if (s.items.some(i => i.uid === uid)) return s.id
  }
  return model.value.sections[0]?.id || null
}

function showTooltip(e, entry) {
  const d = entry.display
  if (!d.desc && !d.cost && d.weight == null) return
  const rect = e.currentTarget.getBoundingClientRect()
  const above = window.innerHeight - rect.bottom < 150
  Object.assign(tooltip, {
    visible: true, name: d.name, desc: d.desc,
    item: d.base || (d.isCustom ? { name: d.name, data: { desc: d.desc, consumable: d.consumable } } : null),
    x: Math.min(rect.left, window.innerWidth - 320),
    top: above ? null : rect.bottom + 6,
    bottom: above ? window.innerHeight - rect.top + 6 : null,
  })
}
function hideTooltip() { tooltip.visible = false }

onMounted(async () => {
  try {
    const ids = allCatalogIds(model.value)
    if (ids.length) {
      const r = await itemsApi.byIds(ids)
      for (const item of r?.items || []) catalog[item.id] = item
    }
  } catch { /* ignore */ } finally {
    loading.value = false
  }
})
</script>

<style scoped src="./styles/DndItems.css"></style>
