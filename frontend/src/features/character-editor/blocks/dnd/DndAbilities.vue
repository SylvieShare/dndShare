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

    <FeatChoiceModal
      v-if="featConfigItem"
      :item="featConfigItem"
      :excluded-choices="featExcludedChoices"
      @confirm="onFeatChoicesConfirm"
      @close="featConfigItem = null"
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
import FeatChoiceModal from '@/features/character-editor/components/FeatChoiceModal.vue'
import ItemEditModal from "@/features/character-editor/components/ItemEditModal"
import ItemPickerModal from "@/features/handbook/components/ItemPickerModal.vue"
import ItemTooltip from "@/features/character-editor/components/ItemTooltip"
import MorphEditorShell from "@/features/character-editor/components/MorphEditorShell"
import AbilityTooltipDetails from "@/features/items/detail-components/AbilityTooltipDetails"
import ItemViewModal from "@/features/handbook/components/ItemViewModal.vue"
import { featChoices, featEntry } from '@/features/items/lib/featRules'
import { ensureItemNames, itemName } from '@/features/handbook/objects/lib/itemNames'
import { useSuggestStore } from '@/stores/suggest'
import { useMorphOrigin } from "@/features/character-editor/composables/useMorphOrigin"

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: false })
const suggestStore = useSuggestStore()

const root        = ref(null)
const catalog     = ref([])
const loading     = ref(true)
const modalEntry  = ref(null)
const pickerOpen  = ref(false)
const tooltip     = reactive({ visible: false, name: '', desc: '', item: null, x: 0, top: null, bottom: null })
const form        = reactive({ open: false, editingItem: null, initialName: '' })
const featConfigItem = ref(null)
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
        key: s.uid || String(s.id),
        uid: s.uid,
        id: s.id,
        name: item.name,
        svg: item.svg || '',
        desc: Number(props.block.content.item_id) === 7 ? (item.data?.description || '') : (item.data?.desc || ''),
        max_use: maxUse,
        manual_size: manualSize,
        rollback_short_rest: !!item.data?.rollback_short_rest,
        rollback_long_rest:  !!item.data?.rollback_long_rest,
        count: s.count ?? maxUse ?? 0,
        choices: s.choices || {},
        choice_summary: Number(props.block.content.item_id) === 7 ? featChoiceSummary(item, s.choices || {}) : '',
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
const usedIds       = computed(() => stored.value
  .filter((storedEntry) => !catalog.value.find((item) => item.id === storedEntry.id)?.data?.repeatable)
  .map((storedEntry) => storedEntry.id))
const featExcludedChoices = computed(() => {
  const item = featConfigItem.value
  if (!item?.data?.repeatable) return {}
  const uniqueKeys = new Set([
    item.data.unique_choice_key,
    ...featChoices(item).filter((choice) => choice.unique_across_takes).map((choice) => choice.key),
  ].filter(Boolean))
  const result = {}
  for (const entry of stored.value.filter((storedEntry) => storedEntry.id === item.id)) {
    for (const key of uniqueKeys) result[key] = [...(result[key] || []), ...(entry.choices?.[key] || [])]
  }
  return result
})

function featChoiceSummary(item, selections) {
  const labels = []
  for (const choice of featChoices(item)) {
    for (const value of (selections[choice.key] || [])) {
      if (choice.source === 'suggest') {
        labels.push(suggestStore.items(Number(choice.from_suggest_id)).find((entry) => String(entry.id) === String(value))?.value || `#${value}`)
      } else if (choice.source === 'item') {
        labels.push(itemName(value) || `#${value}`)
      } else {
        labels.push(choice.options?.find((option) => String(option.value ?? option.label) === String(value))?.label || String(value))
      }
    }
  }
  return labels.join(', ')
}

function hydrateFeatChoices() {
  if (Number(props.block.content.item_id) !== 7) return
  const itemIds = []
  for (const item of catalog.value) {
    for (const choice of featChoices(item)) {
      if (choice.from_suggest_id) suggestStore.ensure(Number(choice.from_suggest_id))
      if (choice.source !== 'item') continue
      for (const storedEntry of stored.value.filter((entry) => entry.id === item.id)) {
        itemIds.push(...(storedEntry?.choices?.[choice.key] || []))
      }
    }
  }
  if (itemIds.length) ensureItemNames(itemIds)
}

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
  if (Number(props.block.content.item_id) === 7 && featChoices(item).length) {
    featConfigItem.value = item
    pickerOpen.value = false
    return
  }
  if (Number(props.block.content.item_id) === 7) {
    emitChange([...stored.value, featEntry(item)])
    return
  }
  const manualSize = !!item.data?.manual_size
  const maxUse = item.data?.max_use ?? null
  const entry = { id: item.id, count: maxUse ?? 0 }
  if (manualSize) entry.max_use = maxUse ?? 0
  emitChange([...stored.value, entry])
}

function onFeatChoicesConfirm(choices) {
  emitChange([...stored.value, featEntry(featConfigItem.value, choices)])
  featConfigItem.value = null
}

function removeAbility(key) {
  hideTooltip()
  emitChange(stored.value.filter(s => (s.uid || String(s.id)) !== key))
}

function reorderAbilities(keys) {
  const byKey = new Map(stored.value.map(s => [s.uid || String(s.id), s]))
  emitChange(keys.map(key => byKey.get(key)).filter(Boolean))
}

function toggleDot(entry, i) {
  const newCount = i <= entry.count ? i - 1 : i
  emitChange(stored.value.map(s => (s.uid || String(s.id)) === entry.key ? { ...s, count: newCount } : s))
}

function increaseMaxUse(entry) {
  const newMax = (entry.max_use ?? 0) + 1
  emitChange(stored.value.map(s =>
    (s.uid || String(s.id)) === entry.key ? { ...s, max_use: newMax, count: (s.count ?? 0) + 1 } : s
  ))
}

function decreaseMaxUse(entry) {
  const newMax = Math.max(0, (entry.max_use ?? 0) - 1)
  emitChange(stored.value.map(s => {
    if ((s.uid || String(s.id)) !== entry.key) return s
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
      hydrateFeatChoices()
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
