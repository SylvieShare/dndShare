<template>
  <Teleport to="body">
    <div class="picker-overlay" @click.self="$emit('close')">
      <div class="picker-modal">

        <div class="picker-topbar">
          <div class="picker-topbar-left">
            <span class="picker-title">{{ title }}</span>
            <span v-if="itemType" class="picker-count">{{ itemType.count ?? '' }}</span>
          </div>

          <div class="picker-search-wrap">
            <svg class="picker-search-icon" viewBox="0 0 16 16" fill="none" width="14" height="14">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.5"/>
              <path d="M10 10L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <input
              v-model="searchQ"
              class="picker-search"
              type="text"
              :placeholder="searchPlaceholder"
              autofocus
              @input="onSearchInput"
            />
          </div>

          <div v-if="groupFields.length" class="picker-group">
            <span class="picker-group-label">ГРУППИРОВКА</span>
            <button
              v-for="f in groupFields"
              :key="f.key"
              class="picker-group-btn"
              :class="{ active: groupBy === f.key }"
              @click="groupBy = groupBy === f.key ? null : f.key"
            >{{ f.nameShort || f.name }}</button>
          </div>

          <button class="picker-close" @click="$emit('close')">
            <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div v-if="allTypes.length > 1" class="picker-tabs">
          <button
            v-for="t in allTypes"
            :key="t.id"
            class="picker-tab"
            :class="{ active: activeTypeId === t.id }"
            @click="setActiveType(t.id)"
          >
            <SvgIcon v-if="t.svg" class="picker-tab-icon" :svg="t.svg" />
            <span class="picker-tab-name">{{ t.name }}</span>
            <span v-if="t.count != null" class="picker-tab-count">{{ t.count }}</span>
          </button>
        </div>

        <div class="picker-body">
          <HandbookItemList
            :type="itemType"
            :selected-item="selectedItem"
            :items="filteredItems"
            :loading="loading"
            :loading-more="loadingMore"
            :has-more="hasMore"
            :group-by="groupBy"
            class="picker-list"
            @select="selectedItem = $event"
            @load-more="loadMore"
          />
          <HandbookItemDetail
            :item="selectedItem"
            :type="itemType"
            :can-edit="false"
            class="picker-detail"
          />
        </div>

        <div class="picker-footer">
          <span v-if="selectedItem" class="picker-footer-name">{{ selectedItem.name }}</span>
          <span v-else class="picker-footer-hint">Выберите предмет</span>
          <button class="picker-create-btn" @click="createOpen = true">+ Создать новый</button>
          <div v-if="allowQuantity" class="picker-qty">
            <span class="picker-qty-label">Кол-во</span>
            <button
              type="button"
              class="picker-qty-btn"
              :disabled="quantity <= 1"
              @click="quantity = Math.max(1, quantity - 1)"
            >−</button>
            <input
              v-model.number="quantity"
              type="number"
              min="1"
              max="999"
              class="picker-qty-input"
            />
            <button
              type="button"
              class="picker-qty-btn"
              :disabled="quantity >= 999"
              @click="quantity = Math.min(999, quantity + 1)"
            >+</button>
          </div>
          <button
            class="picker-add-btn"
            :disabled="!selectedItem"
            @click="pick"
          >
            + Добавить<span v-if="allowQuantity && quantity > 1"> ×{{ quantity }}</span>
          </button>
        </div>

        <ItemEditModal
          v-if="createOpen && activeTypeId != null"
          :type-id="activeTypeId"
          @close="createOpen = false"
          @saved="onItemCreated"
        />

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { fetchGet } from '@/shared/api/http'
import HandbookItemDetail from '@/features/handbook/components/HandbookItemDetail'
import SvgIcon from '@/shared/ui/SvgIcon'
import HandbookItemList from '@/features/handbook/components/HandbookItemList'
import ItemEditModal from '@/features/character-editor/components/ItemEditModal'
import { collectSuggestIds } from '@/features/handbook/objects/lib/schemaFields'
import { useItemTypesStore } from '@/stores/itemTypes'
import { useSuggestStore } from '@/stores/suggest'

const PAGE_SIZE = 30

const props = defineProps({
  itemTypeIds: { type: Array, required: true },
  title: { type: String, default: 'Выбрать' },
  searchPlaceholder: { type: String, default: 'Поиск...' },
  excludeItems: { type: Array, default: () => [] },
  allowQuantity: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'pick'])
const quantity = ref(1)

const allTypes = ref([])
const activeTypeId = ref(props.itemTypeIds[0] ?? null)

const itemType = computed(() => allTypes.value.find(t => t.id === activeTypeId.value) || null)

const items = ref([])
const selectedItem = ref(null)
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(false)
const searchQ = ref('')
const groupBy = ref(null)
const createOpen = ref(false)
let offset = 0
let reqSeq = 0
let searchTimer = null

const excludeSet = computed(() =>
  new Set(props.excludeItems.map(i => i?.id ?? i).filter(x => x != null).map(String))
)

const groupFields = computed(() =>
  (itemType.value?.fields || []).filter(f => f.group)
)

const filteredItems = computed(() =>
  [...items.value]
    .filter(i => !excludeSet.value.has(String(i.id)))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'))
)

async function loadTypes() {
  const itemTypesStore = useItemTypesStore()
  const all = await itemTypesStore.ensureAll().catch(() => [])
  const wanted = new Set(props.itemTypeIds)
  allTypes.value = props.itemTypeIds
    .map(id => all.find(t => t.id === id) || { id, name: '#' + id, fields: [] })
    .filter(t => wanted.has(t.id))
  ensureSuggestsForType(itemType.value)
}

function ensureSuggestsForType(type) {
  if (!type) return
  const store = useSuggestStore()
  for (const sid of collectSuggestIds(type.fields || [])) store.ensure(sid)
}

function setActiveType(id) {
  if (id === activeTypeId.value) return
  activeTypeId.value = id
  searchQ.value = ''
  groupBy.value = null
  selectedItem.value = null
  items.value = []
  ensureSuggestsForType(itemType.value)
  fetchItems('')
}

async function fetchItems(q, append = false) {
  if (!activeTypeId.value) return
  if (append && (!hasMore.value || loading.value || loadingMore.value)) return
  const id = ++reqSeq
  const off = append ? offset : 0
  if (append) loadingMore.value = true
  else { loading.value = true; hasMore.value = false }
  try {
    const lq = `&limit=${PAGE_SIZE}&offset=${off}`
    const url = q.trim()
      ? `/items/search?typeId=${activeTypeId.value}&q=${encodeURIComponent(q.trim())}${lq}`
      : `/items?typeId=${activeTypeId.value}${lq}`
    const res = await fetchGet(url)
    if (id !== reqSeq) return
    const next = res?.items || []
    if (append) {
      const ids = new Set(items.value.map(i => i.id))
      items.value = [...items.value, ...next.filter(i => !ids.has(i.id))]
    } else {
      items.value = next
    }
    offset = off + next.length
    hasMore.value = next.length === PAGE_SIZE
  } finally {
    if (id === reqSeq) { loading.value = false; loadingMore.value = false }
  }
}

function loadMore() { fetchItems(searchQ.value, true) }

function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchItems(searchQ.value), 280)
}

watch(searchQ, (val) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchItems(val), 280)
})

function pick() {
  if (!selectedItem.value) return
  const qty = props.allowQuantity ? Math.max(1, Math.min(999, Math.floor(Number(quantity.value) || 1))) : 1
  emit('pick', selectedItem.value, qty)
  emit('close')
}

function onItemCreated(item) {
  createOpen.value = false
  items.value = [item, ...items.value]
  selectedItem.value = item
}

onMounted(async () => {
  await loadTypes()
  fetchItems('')
})
</script>

<style scoped>
.picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  padding: 24px;
  box-sizing: border-box;
}

.picker-modal {
  background: var(--bg, #13131a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.75);
  width: 100%;
  max-width: 1100px;
  height: 85vh;
  max-height: 820px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.picker-topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--bg-header, #1a1a24);
}

.picker-topbar-left {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-shrink: 0;
}

.picker-title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  color: var(--text-1, var(--text-1));
}

.picker-count {
  font-size: 12px;
  color: var(--text-muted, var(--text-muted));
}

.picker-search-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 8px;
  padding: 0 12px;
  height: 36px;
}

.picker-search-icon { color: var(--text-muted, var(--text-muted)); flex-shrink: 0; }

.picker-search {
  background: none;
  border: none;
  color: var(--text-1, var(--text-1));
  font: inherit;
  font-size: 13px;
  outline: none;
  flex: 1;
  min-width: 0;
}

.picker-search::placeholder { color: var(--text-muted, var(--text-muted)); }

.picker-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.picker-group-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--text-muted, var(--text-muted));
}

.picker-group-btn {
  background: none;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 5px;
  color: var(--text-2, var(--text-2));
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}

.picker-group-btn:hover { background: rgba(255,255,255,0.06); color: var(--text-1, var(--text-1)); }
.picker-group-btn.active {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
  color: var(--accent, var(--accent));
}

.picker-close {
  background: none;
  border: none;
  color: var(--text-muted, var(--text-muted));
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  transition: color 0.12s, background 0.12s;
}
.picker-close:hover { color: var(--text-1, var(--text-1)); background: rgba(255,255,255,0.06); }

.picker-tabs {
  display: flex;
  align-items: stretch;
  gap: 2px;
  padding: 0 14px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-header, #1a1a24);
  overflow-x: auto;
  scrollbar-width: none;
  flex-shrink: 0;
}
.picker-tabs::-webkit-scrollbar { display: none; }

.picker-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  color: var(--text-muted, #6a6a7a);
  padding: 10px 14px 12px;
  white-space: nowrap;
  transition: color 0.15s;
}

.picker-tab::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 6px;
  right: 6px;
  height: 2px;
  border-radius: 999px;
  background: transparent;
  transition: background 0.15s;
}

.picker-tab:hover { color: var(--text-2, #c0c0cc); }
.picker-tab.active { color: #fff; font-weight: 700; }
.picker-tab.active::after { background: var(--accent, var(--accent)); }

.picker-tab-icon {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0.5;
  transition: opacity 0.15s, filter 0.15s;
}
.picker-tab.active .picker-tab-icon {
  opacity: 1;
  filter: brightness(1.3) saturate(1.4);
}

.picker-tab-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted, var(--text-muted));
}
.picker-tab.active .picker-tab-count { color: var(--text-2, #b0b0c0); }

.picker-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
  border-bottom: 1px solid var(--border);
}

.picker-list { flex-shrink: 0; }
.picker-detail { flex: 1; min-width: 0; }

.picker-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: var(--bg-header, #1a1a24);
  flex-shrink: 0;
}

.picker-footer-name {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1, var(--text-1));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.picker-footer-hint {
  flex: 1;
  font-size: 13px;
  color: var(--text-muted, var(--text-muted));
}

.picker-add-btn {
  background: var(--accent, var(--accent));
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 9px 20px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.picker-add-btn:hover:not(:disabled) { opacity: 0.85; }
.picker-add-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.picker-create-btn {
  background: none;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  color: var(--text-2, var(--text-2));
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 9px 16px;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.picker-create-btn:hover {
  color: var(--text-1, var(--text-1));
  border-color: rgba(255,255,255,0.25);
  background: rgba(255,255,255,0.04);
}

.picker-qty {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 3px 6px;
}
.picker-qty-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-muted, var(--text-muted));
  text-transform: uppercase;
  padding: 0 4px;
}
.picker-qty-btn {
  width: 24px;
  height: 24px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  color: var(--text-2, var(--text-2));
  border-radius: 5px;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.picker-qty-btn:hover:not(:disabled) { background: rgba(255,255,255,0.12); color: var(--text-1, var(--text-1)); }
.picker-qty-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.picker-qty-input {
  width: 44px;
  text-align: center;
  background: none;
  border: none;
  color: var(--text-1, var(--text-1));
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  outline: none;
  -moz-appearance: textfield;
}
.picker-qty-input::-webkit-outer-spin-button,
.picker-qty-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
</style>
