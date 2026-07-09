<template>
  <div ref="root" class="ab-block">
    <BaseTile class="ab-tile">
      <DndAbilitiesView
        :entries="entries"
        :loading="loading"
        :skeleton-count="skeletonCount"
        :title="title"
        :manage="ownerMode"
        @toggle-dot="toggleDot"
        @view="onView"
        @manage="onManage"
        @show-tooltip="showTooltip"
        @hide-tooltip="hideTooltip"
      />
    </BaseTile>

    <MorphEditorShell
      v-if="editorOpen"
      :origin-rect="originRect"
      :origin-el="originEl"
      :strip="false"
      :min-view-width="300"
      @close="close"
    >
      <template #view="{ revealed }">
        <DndAbilitiesView
          :entries="entries"
          :loading="loading"
          :skeleton-count="skeletonCount"
          :title="title"
          manage
          :edit-fade="revealed"
          panel
          @toggle-dot="toggleDot"
          @view="onView"
          @show-tooltip="showTooltip"
          @hide-tooltip="hideTooltip"
        />
      </template>
      <template #editor>
        <DndAbilitiesEditor
          :entries="entries"
          @add="pickerOpen = true"
          @remove="removeAbility"
          @inc="increaseMaxUse"
          @dec="decreaseMaxUse"
          @edit="openEditForm"
          @reorder="reorderAbilities"
        />
      </template>
    </MorphEditorShell>

    <ItemPickerModal
      v-if="pickerOpen && block.content.item_id"
      :item-type-ids="[block.content.item_id]"
      :exclude-items="usedIds"
      title="Способности"
      search-placeholder="Поиск способности..."
      @close="pickerOpen = false"
      @pick="addFromCatalog"
    />

    <ItemTooltip
      v-if="tooltip.visible"
      :title="tooltip.name"
      :desc="tooltip.desc"
      :x="tooltip.x"
      :top="tooltip.top"
      :bottom="tooltip.bottom"
    >
      <template v-if="tooltip.item && (tooltip.item.data?.max_use || tooltip.item.data?.rollback_short_rest || tooltip.item.data?.rollback_long_rest)" #details>
        <AbilityTooltipDetails :item="tooltip.item" />
      </template>
    </ItemTooltip>

    <ItemEditModal
      v-if="form.open"
      :type-id="block.content.item_id"
      :item="form.editingItem"
      :initial-name="form.initialName"
      @close="form.open = false"
      @saved="onFormSaved"
    />

    <ItemViewModal
      v-if="modalEntry && modalItem"
      :item-type-id="block.content.item_id ?? 3"
      :item-id="modalItem.id"
      :item="modalItem"
      @close="modalEntry = null"
    />
  </div>
</template>

<script setup>
import { computed, inject, onMounted, reactive, ref } from 'vue'

import { itemsApi } from '@/shared/api/itemsApi'
import BaseTile from "@/shared/ui/BaseTile"
import DndAbilitiesEditor from "@/features/character-editor/blocks/dnd/components/DndAbilitiesEditor"
import DndAbilitiesView from "@/features/character-editor/blocks/dnd/components/DndAbilitiesView"
import ItemEditModal from "@/features/character-editor/components/ItemEditModal"
import ItemPickerModal from "@/features/character-editor/components/ItemPickerModal"
import ItemTooltip from "@/features/character-editor/components/ItemTooltip"
import MorphEditorShell from "@/features/character-editor/components/MorphEditorShell"
import AbilityTooltipDetails from "@/features/items/detail-components/AbilityTooltipDetails"
import ItemViewModal from "@/shared/ui/ItemViewModal"
import { useMorphOrigin } from "@/features/character-editor/composables/useMorphOrigin"

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: false })

const root        = ref(null)
const catalog     = ref([])
const loading     = ref(true)
const modalEntry  = ref(null)
const pickerOpen  = ref(false)
const tooltip     = reactive({ visible: false, name: '', desc: '', item: null, x: 0, top: null, bottom: null })
const form        = reactive({ open: false, editingItem: null, initialName: '' })
const { editorOpen, originRect, originEl, openFrom, close } = useMorphOrigin()

const ownerMode = computed(() => charCtx.ownerMode)
const title = computed(() => props.block.title || props.block.content?.title || '')
const stored = computed(() => props.value || [])

const entries = computed(() =>
  stored.value
    .map(s => {
      const item = catalog.value.find(c => c.id === s.id)
      if (!item) return null
      const manualSize = !!item.data?.manual_size
      const catalogMaxUse = item.data?.max_use ?? null
      const maxUse = manualSize ? (s.max_use ?? catalogMaxUse ?? 0) : catalogMaxUse
      return {
        id: s.id,
        name: item.name,
        desc: item.data?.desc || '',
        max_use: maxUse,
        manual_size: manualSize,
        rollback_short_rest: !!item.data?.rollback_short_rest,
        rollback_long_rest:  !!item.data?.rollback_long_rest,
        count: s.count ?? maxUse ?? 0,
        isUserOwned: item.userId != null,
      }
    })
    .filter(Boolean)
)

const modalItem = computed(() => {
  if (!modalEntry.value) return null
  const item = catalog.value.find(c => c.id === modalEntry.value.id)
  return item || { name: modalEntry.value.name, data: {} }
})

const skeletonCount = computed(() => Math.max(1, stored.value.length) || 2)
const usedIds       = computed(() => stored.value.map(s => s.id))

function emitChange(newStored) {
  emit('update:value', props.block.id, newStored)
}

function onManage() {
  hideTooltip()
  openFrom(root.value)
}

function onView(entry) {
  modalEntry.value = entry
}

function addFromCatalog(item) {
  if (!catalog.value.find(c => c.id === item.id)) catalog.value.push(item)
  const manualSize = !!item.data?.manual_size
  const maxUse = item.data?.max_use ?? null
  const entry = { id: item.id, count: maxUse ?? 0 }
  if (manualSize) entry.max_use = maxUse ?? 0
  emitChange([...stored.value, entry])
}

function removeAbility(id) {
  hideTooltip()
  emitChange(stored.value.filter(s => s.id !== id))
}

function reorderAbilities(ids) {
  const byId = new Map(stored.value.map(s => [s.id, s]))
  emitChange(ids.map(id => byId.get(id)).filter(Boolean))
}

function toggleDot(entry, i) {
  const newCount = i <= entry.count ? i - 1 : i
  emitChange(stored.value.map(s => s.id === entry.id ? { ...s, count: newCount } : s))
}

function increaseMaxUse(entry) {
  const newMax = (entry.max_use ?? 0) + 1
  emitChange(stored.value.map(s =>
    s.id === entry.id ? { ...s, max_use: newMax, count: (s.count ?? 0) + 1 } : s
  ))
}

function decreaseMaxUse(entry) {
  const newMax = Math.max(0, (entry.max_use ?? 0) - 1)
  emitChange(stored.value.map(s => {
    if (s.id !== entry.id) return s
    return { ...s, max_use: newMax, count: Math.min(s.count ?? 0, newMax) }
  }))
}

function showTooltip(e, entry) {
  if (!entry.desc && !entry.max_use && !entry.rollback_short_rest && !entry.rollback_long_rest) return
  const rect = e.currentTarget.getBoundingClientRect()
  const above = window.innerHeight - rect.bottom < 220
  Object.assign(tooltip, {
    visible: true,
    name: entry.name, desc: entry.desc,
    item: catalog.value.find(it => it.id === entry.id) || null,
    x: Math.min(rect.left, window.innerWidth - 350),
    top: above ? null : rect.bottom + 8,
    bottom: above ? window.innerHeight - rect.top + 8 : null,
  })
}

function hideTooltip() { tooltip.visible = false }

function openEditForm(entry) {
  const item = catalog.value.find(it => it.id === entry.id)
  if (!item) return
  Object.assign(form, { open: true, editingItem: item, initialName: '' })
}

function onFormSaved(item) {
  const idx = catalog.value.findIndex(it => it.id === item.id)
  if (idx >= 0) catalog.value[idx] = item
  else catalog.value.push(item)
  if (!form.editingItem) addFromCatalog(item)
  form.open = false
}

onMounted(async () => {
  if (stored.value.length > 0) {
    const ids = stored.value.map(s => s.id)
    try {
      const r = await itemsApi.byIds(ids)
      catalog.value = r.items || []
    } catch (e) { /* show what we have */ }
  }
  loading.value = false
})
</script>

<style scoped>
.ab-block { min-width: 0; }

.ab-tile {
  display: block;
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
}
</style>
