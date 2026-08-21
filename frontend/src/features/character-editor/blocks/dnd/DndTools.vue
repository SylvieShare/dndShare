<template>
  <div v-if="entries.length || charCtx.ownerMode" class="dt-block">
    <div class="dt-head">
      <span class="dt-title">Инструменты</span>
      <span v-if="entries.length" class="dt-count">{{ entries.length }}</span>
      <span class="dt-line" aria-hidden="true"></span>
    </div>

    <div class="dt-list">
      <RowActionMenu v-for="entry in displayEntries" :key="entry.uid" block>
        <template #trigger>
          <button class="dt-row" type="button" :title="`Действия: ${entry.display.name}`">
            <InventoryItemIcon
              :svg="entry.display.svg"
              :image-url="entry.display.iconImageUrl"
              :type-image-url="entry.display.typeImageUrl"
            />
            <span class="dt-copy">
              <span class="dt-name">{{ entry.display.name }}</span>
              <span class="dt-meta">
                <span v-if="isProficient(entry)" class="dt-proficient">Владение</span>
                <span v-else>Нет владения</span>
                <span v-if="entry.count > 1">×{{ entry.count }}</span>
              </span>
            </span>
          </button>
        </template>

        <template #default="{ close }">
          <RowActionItem action="view" @click="viewEntry(entry, close)">Открыть описание</RowActionItem>
          <RowActionItem
            v-if="charCtx.ownerMode"
            :icon="BadgeCheck"
            :tone="isProficient(entry) ? 'default' : 'success'"
            @click="toggleProficiency(entry, close)"
          >{{ isProficient(entry) ? 'Убрать владение' : 'Отметить владение' }}</RowActionItem>
          <RowActionItem v-if="charCtx.ownerMode" action="replenish" tone="success" @click="increment(entry, close)">Добавить экземпляр</RowActionItem>
          <RowActionItem v-if="charCtx.ownerMode" action="remove" tone="danger" @click="decrement(entry, close)">Убрать экземпляр</RowActionItem>
          <RowActionItem
            v-if="charCtx.ownerMode && typeof charCtx.updateValues === 'function'"
            :icon="ArrowRightLeft"
            @click="moveToInventory(entry, close)"
          >Переместить в вещи</RowActionItem>
        </template>
      </RowActionMenu>
    </div>

    <button v-if="charCtx.ownerMode" class="dt-add" type="button" @click="pickerOpen = true">+ Добавить инструмент</button>

    <ItemViewModal
      v-if="modalItem"
      :item-type-id="toolTypeId"
      :item-id="modalItem.id"
      :item="modalItem"
      @close="modalEntryUid = null"
    />
    <ItemPickerModal
      v-if="pickerOpen"
      :item-type-ids="[toolTypeId]"
      title="Инструменты"
      search-placeholder="Поиск инструмента..."
      allow-quantity
      @close="pickerOpen = false"
      @pick="onPick"
    />
  </div>
</template>

<script setup>
import { computed, inject, onMounted, reactive, ref } from 'vue'
import { ArrowRightLeft, BadgeCheck } from '@lucide/vue'

import InventoryItemIcon from '@/features/character-editor/components/InventoryItemIcon.vue'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { RowActionMenu } from '@sylvieshare/share-ui'
import { itemsApi } from '@/shared/api/itemsApi'
import { defaultInstanceParams, instanceParamsKey } from '@/features/items/lib/itemInstance'
import { entryDisplayData, makeEntryUid } from './lib/itemSection'
import { appendInventoryEntry, cloneOwnedCollection } from './lib/itemPlacement'
import { logSessionEntryAdded } from '@/features/character-editor/lib/sessionEntryEvents'
import { useItemTypesStore } from '@/stores/itemTypes'

const TOOL_TYPE = 14
const TOOL_PROFICIENCY_BUCKET = 'Инструменты'

const props = defineProps({ block: Object, value: { default: null } })
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', () => ({ ownerMode: false }))
const itemTypesStore = useItemTypesStore()
const catalog = reactive({})
const pickerOpen = ref(false)
const modalEntryUid = ref(null)
const entries = computed(() => cloneOwnedCollection(props.value))
const toolTypeId = computed(() => Number(props.block.content?.item_type_id) || TOOL_TYPE)
const proficiencyBucket = computed(() => props.block.content?.proficiency_bucket || TOOL_PROFICIENCY_BUCKET)
const typeById = computed(() => Object.fromEntries(itemTypesStore.allTypes.map(type => [type.id, type])))
const displayEntries = computed(() => entries.value.map(entry => ({
  ...entry,
  display: entryDisplayData(entry, catalog, typeById.value),
})))
const modalItem = computed(() => {
  const entry = entries.value.find(saved => saved.uid === modalEntryUid.value)
  return entry?.item_id != null ? catalog[entry.item_id] || null : null
})

function proficiencyName(value) {
  if (value && typeof value === 'object') return String(value.name ?? value.value ?? value.title ?? '')
  return String(value ?? '')
}

function toolProficiencies() {
  const values = charCtx.values?.proficiencies?.[proficiencyBucket.value]
  return Array.isArray(values) ? values : []
}

function isProficient(entry) {
  const name = entry.display.name.trim().toLocaleLowerCase('ru')
  return toolProficiencies().some(value => proficiencyName(value).trim().toLocaleLowerCase('ru') === name)
}

function emitEntries(next) {
  emit('update:value', props.block.id, next)
}

function viewEntry(entry, close) {
  if (entry.item_id != null) modalEntryUid.value = entry.uid
  close()
}

function increment(entry, close) {
  const next = cloneOwnedCollection(entries.value)
  const saved = next.find(item => item.uid === entry.uid)
  if (saved) saved.count = Math.min(999, saved.count + 1)
  emitEntries(next)
  close()
}

function decrement(entry, close) {
  const next = cloneOwnedCollection(entries.value)
  const index = next.findIndex(item => item.uid === entry.uid)
  if (index >= 0 && next[index].count > 1) next[index].count -= 1
  else if (index >= 0) next.splice(index, 1)
  emitEntries(next)
  close()
}

function toggleProficiency(entry, close) {
  if (typeof charCtx.updateValues !== 'function') return
  const proficiencies = { ...(charCtx.values?.proficiencies || {}) }
  const current = [...toolProficiencies()]
  const normalized = entry.display.name.trim().toLocaleLowerCase('ru')
  const index = current.findIndex(value => proficiencyName(value).trim().toLocaleLowerCase('ru') === normalized)
  if (index >= 0) current.splice(index, 1)
  else current.push(entry.display.name)
  proficiencies[proficiencyBucket.value] = current
  charCtx.updateValues({ proficiencies })
  close()
}

function moveToInventory(entry, close) {
  const next = cloneOwnedCollection(entries.value).filter(saved => saved.uid !== entry.uid)
  charCtx.updateValues({
    tools: next,
    items: appendInventoryEntry(charCtx.values?.items, entry),
  })
  close()
}

function onPick(item, quantity = 1) {
  const count = Math.max(1, Math.min(999, Math.floor(Number(quantity) || 1)))
  catalog[item.id] = item
  const next = cloneOwnedCollection(entries.value)
  const params = defaultInstanceParams(typeById.value[item.typeId], item)
  const existing = next.find(entry => entry.item_id === item.id && !entry.override
    && instanceParamsKey(entry.params) === instanceParamsKey(params))
  if (existing) existing.count = Math.min(999, existing.count + count)
  else next.push({ uid: makeEntryUid(), item_id: item.id, count, params, override: null })
  pickerOpen.value = false
  emitEntries(next)
  logSessionEntryAdded(charCtx, { kind: 'item', title: item.name, itemId: item.id, count })
}

onMounted(async () => {
  await itemTypesStore.ensureAll().catch(() => [])
  const ids = [...new Set(entries.value.map(entry => entry.item_id).filter(id => id != null))]
  if (!ids.length) return
  const response = await itemsApi.byIds(ids).catch(() => null)
  for (const item of (response?.items || [])) catalog[item.id] = item
})
</script>

<style scoped>
.dt-block { display: flex; flex-direction: column; gap: 10px; }
.dt-head { display: flex; align-items: center; gap: 10px; min-height: 24px; }
.dt-title { color: var(--text-muted); font-size: 12px; font-weight: 650; letter-spacing: .08em; line-height: 1.15; text-transform: uppercase; }
.dt-count { color: var(--text-muted); font-size: 12px; font-weight: 700; }
.dt-line { flex: 1; min-width: 20px; height: 1px; background: color-mix(in srgb, var(--text-muted) 42%, transparent); }
.dt-list { display: flex; flex-direction: column; }
.dt-list :deep(.ram-custom-trigger + .ram-custom-trigger .dt-row) { border-top: 1px solid color-mix(in srgb, var(--text-on-accent) 7%, transparent); }
.dt-row { width: 100%; min-height: 80px; display: flex; align-items: center; gap: 16px; padding: 14px 4px; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.dt-copy { min-width: 0; display: flex; flex: 1; flex-direction: column; gap: 5px; }
.dt-name { overflow: hidden; color: var(--text-1); font-size: 14px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.dt-meta { display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 11px; }
.dt-proficient { color: var(--success); font-weight: 700; }
.dt-add { min-height: 34px; border: 1px dashed var(--border-strong); border-radius: 8px; background: transparent; color: var(--text-muted); cursor: pointer; font: inherit; font-size: 13px; }
.dt-add:hover { border-color: color-mix(in srgb, var(--accent) 50%, var(--border-strong)); color: var(--text-2); background: color-mix(in srgb, var(--accent) 5%, transparent); }
@media (max-width: 760px) { .dt-block { padding: 14px; border-radius: var(--r-lg); background: var(--surface); box-shadow: inset 0 0 0 1px var(--border); } }
</style>
