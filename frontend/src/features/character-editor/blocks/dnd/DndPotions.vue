<template>
  <div v-if="entries.length || charCtx.ownerMode" class="dp-block">
    <PotionShelf
      :potions="potionEntries"
      :can-use="charCtx.ownerMode"
      :can-add="charCtx.ownerMode"
      @use="onUse"
      @replenish="onReplenish"
      @view="onView"
      @add="pickerOpen = true"
    />

    <ItemViewModal
      v-if="modalItem"
      :item-type-id="modalItem.typeId ?? POTION_TYPE"
      :item-id="modalItem.id"
      :item="modalItem"
      @close="modalEntryUid = null"
    />

    <ItemPickerModal
      v-if="pickerOpen"
      :item-type-ids="[POTION_TYPE]"
      title="Зелья"
      search-placeholder="Поиск зелья..."
      allow-quantity
      @close="pickerOpen = false"
      @pick="onPick"
    />
  </div>
</template>

<script setup>
import { computed, inject, onMounted, reactive, ref } from 'vue'

import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import PotionShelf from '@/features/character-editor/blocks/dnd/components/PotionShelf'
import { itemsApi } from '@/shared/api/itemsApi'
import { makeEntryUid } from '@/features/character-editor/blocks/dnd/lib/itemSection'
import { logSessionEntryAdded } from '@/features/character-editor/lib/sessionEntryEvents'

const POTION_TYPE = 10

const props = defineProps({ block: Object, value: { default: null } })
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', () => ({ ownerMode: false }))

const catalog = reactive({})
const pickerOpen = ref(false)
const modalEntryUid = ref(null)

// Own data: a flat list of potion entries, decoupled from the inventory block.
const entries = computed(() => (Array.isArray(props.value) ? props.value : []))

const potionEntries = computed(() => entries.value.map(e => {
  const base = catalog[e.id] || {}
  return {
    uid: e.uid,
    id: e.id,
    count: e.count,
    name: e.override?.name ?? base.name ?? 'Зелье',
    color: base.data?.color || null,
    rarity: Number(base.data?.rarity) || 0,
  }
}))

const modalItem = computed(() => {
  const entry = entries.value.find(e => e.uid === modalEntryUid.value)
  return entry?.id != null ? catalog[entry.id] ?? null : null
})

function clone() {
  return entries.value.map(e => ({ uid: e.uid, id: e.id ?? null, count: e.count, override: e.override ? { ...e.override } : null }))
}

function onUse(uid) {
  const next = clone()
  const idx = next.findIndex(e => e.uid === uid)
  if (idx === -1) return
  const count = Math.max(1, Math.min(999, Math.floor(Number(next[idx].count) || 1)))
  const display = potionEntries.value.find(potion => potion.uid === uid)
  if (count > 1) next[idx].count = count - 1
  else next.splice(idx, 1)
  emit('update:value', props.block.id, next)
  charCtx.logSessionEvent?.({
    type: 'item_spent',
    action: `Потрачено: ${display?.name || 'Зелье'}`,
    data: { itemId: display?.id || null, remaining: Math.max(0, count - 1) },
  })
}

function onReplenish(uid) {
  const next = clone()
  const entry = next.find(e => e.uid === uid)
  if (!entry) return
  entry.count = Math.min(999, Math.max(1, Math.floor(Number(entry.count) || 1)) + 1)
  emit('update:value', props.block.id, next)
  const display = potionEntries.value.find(potion => potion.uid === uid)
  charCtx.logSessionEvent?.({
    type: 'item_added',
    action: `Добавлено: ${display?.name || 'Зелье'}`,
    data: { itemId: display?.id || null, remaining: entry.count },
  })
}

function onView(uid) {
  if (entries.value.some(e => e.uid === uid && e.id != null)) modalEntryUid.value = uid
}

function onPick(item, qty = 1) {
  const n = Math.max(1, Math.min(999, Math.floor(Number(qty) || 1)))
  if (!catalog[item.id]) catalog[item.id] = item
  const next = clone()
  // Merge into an existing stack of the same potion (no custom override) so the rack shows one vial.
  const existing = next.find(e => e.id === item.id && !e.override)
  if (existing) existing.count = Math.min(999, (existing.count || 1) + n)
  else next.push({ uid: makeEntryUid(), id: item.id, count: n, override: null })
  pickerOpen.value = false
  emit('update:value', props.block.id, next)
  logSessionEntryAdded(charCtx, { kind: 'potion', title: item.name, itemId: item.id, count: n })
}

async function loadCatalog() {
  const ids = [...new Set(entries.value.map(e => e.id).filter(id => id != null))]
  if (!ids.length) return
  try {
    const r = await itemsApi.byIds(ids)
    for (const item of r?.items || []) catalog[item.id] = item
  } catch { /* ignore */ }
}

onMounted(loadCatalog)
</script>

<style scoped>
.dp-block {
  display: flex;
  flex-direction: column;
}

@media (max-width: 760px) {
  .dp-block {
    padding: 14px;
    border-radius: var(--r-lg);
    background: var(--surface);
    box-shadow: inset 0 0 0 1px var(--border);
  }
}
</style>
