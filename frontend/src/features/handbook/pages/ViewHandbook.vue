<template>
  <div class="handbook-outer" :class="[!selectedType ? 'handbook-outer--landing' : mobilePanel]">

    <!-- ── Collection bar: full viewport width ── -->
    <HandbookCollectionBar
      v-if="selectedType"
      v-model:search="searchQ"
      v-model:group-by="groupBy"
      v-model:filters="filters"
      :type="selectedType"
      :filter-fields="filterFields"
      :filter-suggests="filterSuggests"
      :can-add="isAuth"
      :result-count="filteredItems.length"
      :has-more="hasMore"
      :filtered="isFiltered"
      class="handbook-col-bar"
      @back="goToLanding"
      @add="openAddModal"
    />

    <!-- ── Inner: max-width centered ── -->
    <div class="handbook-page">

      <!-- ── Landing: shown when no type is selected ── -->
      <HandbookLanding
        v-if="!selectedType"
        class="handbook-landing"
        @select-type="selectType"
      />

      <template v-else>

        <!-- ── Mobile: collection picker (full-screen type grid) ── -->
        <div class="handbook-type-grid">
          <button
            v-for="type in types"
            :key="type.id"
            class="type-grid-card"
            :style="type.color ? { '--card-accent': type.color } : {}"
            @click="selectType(type)"
          >
            <img v-if="type.svg" class="type-grid-icon" :src="type.svg" alt="" aria-hidden="true" />
            <span v-else class="type-grid-icon-placeholder" aria-hidden="true"></span>
            <span class="type-grid-name">{{ type.name }}</span>
            <span v-if="type.count != null" class="type-grid-count">{{ type.count }}</span>
          </button>
        </div>

        <!-- ── Main content: list + detail ── -->
        <div class="handbook-body">

          <!-- Mobile back button in list panel -->
          <div class="mobile-back-bar">
            <button class="mobile-back-btn" @click="goBack">
              <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                <path d="M10 13L5 8L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              {{ mobilePanel === 'panel-detail' ? (selectedType && selectedType.name) : 'Коллекции' }}
            </button>
            <span v-if="mobilePanel === 'panel-detail' && selectedItem" class="mobile-back-title">{{ selectedItem.name }}</span>
          </div>

          <HandbookItemList
            :type="selectedType"
            :selected-item="selectedItem"
            :items="filteredItems"
            :loading="loading"
            :loading-more="loadingMore"
            :has-more="hasMore"
            :group-by="groupBy"
            class="handbook-list"
            @select="selectItem"
            @load-more="loadMore"
          />

          <HandbookItemDetail
            :item="selectedItem"
            :type="selectedType"
            :can-edit="canEdit"
            class="handbook-detail"
            @edit="openEditModal"
          />
        </div>

      </template>
    </div>

    <ItemEditModal
      v-if="itemForm.open && selectedType"
      :type-id="selectedType.id"
      :item="itemForm.item"
      :initial-name="itemForm.initialName"
      :initial-name-en="itemForm.initialNameEn"
      show-name-en
      @close="itemForm.open = false"
      @saved="onItemSaved"
    />

  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchGet } from '@/shared/api/http'
import { itemsApi } from '@/shared/api/itemsApi'
import { useAccountStore } from '@/stores/account'
import { useItemTypesStore } from '@/stores/itemTypes'
import { useUiStore } from '@/stores/ui'
import { useSuggestStore } from '@/stores/suggest'
import { collectSuggestIds, getSuggestId, walkFieldsWithPath } from '@/features/handbook/objects/lib/schemaFields'
import HandbookLanding from '@/features/handbook/pages/HandbookLanding'
import HandbookCollectionBar from '@/features/handbook/components/HandbookCollectionBar'
import HandbookItemList from '@/features/handbook/components/HandbookItemList'
import HandbookItemDetail from '@/features/handbook/components/HandbookItemDetail'
import ItemEditModal from '@/features/character-editor/components/ItemEditModal'

// ── Router ──────────────────────────────────────────────────────────────────
const route = useRoute()
const router = useRouter()

// ── Stores ──────────────────────────────────────────────────────────────────
const accountStore = useAccountStore()
const itemTypesStore = useItemTypesStore()
const suggestStore = useSuggestStore()
const uiStore = useUiStore()

// ── State ────────────────────────────────────────────────────────────────────
const types = ref([])
const selectedType = ref(null)
const items = ref([])
const selectedItem = ref(null)
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(false)
const itemPageSize = 30
let itemOffset = 0
let itemsRequestSeq = 0
const searchQ = ref('')
const filters = ref({})
const groupBy = ref(null)
const skipSearchWatch = ref(false)
const skipFiltersWatch = ref(false)
const skipGroupWatch = ref(false)
let searchTimer = null
const itemForm = reactive({ open: false, item: null, initialName: '', initialNameEn: '' })

// ── Auth ─────────────────────────────────────────────────────────────────────
const isAuth = computed(() => accountStore.authStatus === 'success')
const isAdmin = computed(() => accountStore.user?.roles?.includes('HANDBOOK_ADMIN'))
const canEdit = computed(() => isAuth.value && (selectedItem.value?.userId != null || isAdmin.value))

// ── Mobile panel state ────────────────────────────────────────────────────────
const mobilePanel = computed(() => {
  if (!selectedType.value) return 'panel-types'
  if (!selectedItem.value) return 'panel-list'
  return 'panel-detail'
})

function goToLanding() {
  selectedType.value = null
  selectedItem.value = null
  router.replace({ query: {} })
}

function goBack() {
  if (mobilePanel.value === 'panel-detail') {
    selectedItem.value = null
    router.replace({ query: { ...route.query, item: undefined } })
  } else {
    goToLanding()
  }
}

// ── Suggest helpers ──────────────────────────────────────────────────────────
function getSuggests(suggestId) { return suggestStore.items(suggestId) || [] }

const filterFields = computed(() =>
  walkFieldsWithPath(selectedType.value?.fields || [])
    .filter(({ field }) => field.filter && field.type !== 'item')
    .map(({ field, path }) => ({ ...field, path }))
)
const filterSuggests = computed(() => {
  const map = {}
  for (const f of filterFields.value) {
    const sid = getSuggestId(f)
    if (sid != null) map[sid] = getSuggests(sid)
  }
  return map
})

const filteredItems = computed(() =>
  [...items.value].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'))
)

const isFiltered = computed(() =>
  !!searchQ.value.trim() || Object.keys(filters.value).length > 0
)

function parseFilters(raw) {
  if (!raw) return {}
  try {
    const val = JSON.parse(raw)
    return val && typeof val === 'object' ? val : {}
  } catch {
    return {}
  }
}

function currentQuery() {
  const q = {}
  if (selectedType.value) q.type = selectedType.value.id
  if (searchQ.value.trim()) q.q = searchQ.value
  if (groupBy.value) q.group = groupBy.value
  if (Object.keys(filters.value).length) q.filters = JSON.stringify(filters.value)
  if (selectedItem.value) q.item = selectedItem.value.id
  return q
}

// ── Data loading ─────────────────────────────────────────────────────────────
async function fetchTypes() {
  await itemTypesStore.ensureAll()
  types.value = itemTypesStore.allTypes
}

function filtersQuery() {
  return Object.keys(filters.value).length
    ? '&filters=' + encodeURIComponent(JSON.stringify(filters.value))
    : ''
}

async function fetchItems(q, append = false) {
  if (!selectedType.value) return
  if (append && (!hasMore.value || loading.value || loadingMore.value)) return

  const requestId = ++itemsRequestSeq
  const offset = append ? itemOffset : 0

  if (append) loadingMore.value = true
  else {
    loading.value = true
    hasMore.value = false
  }

  try {
    const fq = filtersQuery()
    const lq = `&limit=${itemPageSize}&offset=${offset}`
    const url = q.trim()
      ? `/items/search?typeId=${selectedType.value.id}&q=${encodeURIComponent(q)}${lq}${fq}`
      : `/items?typeId=${selectedType.value.id}${lq}${fq}`
    const res = await fetchGet(url)
    if (requestId !== itemsRequestSeq) return
    const next = res.items || []
    if (append) {
      const ids = new Set(items.value.map(i => i.id))
      items.value = [...items.value, ...next.filter(i => !ids.has(i.id))]
    } else {
      items.value = next
    }
    itemOffset = offset + next.length
    hasMore.value = next.length === itemPageSize
  } finally {
    if (requestId === itemsRequestSeq) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

function loadMore() { fetchItems(searchQ.value, true) }

async function resolveItem(itemId) {
  const found = items.value.find(i => i.id === itemId)
  if (found) return found
  const res = await itemsApi.byIds([itemId])
  const item = (res?.items || [])[0]
  if (!item) return null
  items.value = [item, ...items.value]
  return item
}

// ── Type / item selection ────────────────────────────────────────────────────
function selectType(type) {
  selectedType.value = type
  selectedItem.value = null
  skipFiltersWatch.value = true
  filters.value = {}
  skipGroupWatch.value = true
  groupBy.value = null
  if (searchQ.value !== '') skipSearchWatch.value = true
  searchQ.value = ''
  clearTimeout(searchTimer)
  for (const id of collectSuggestIds(type.fields)) suggestStore.ensure(id)
  router.push({ query: { type: type.id } })
  fetchItems('')
}

function selectItem(item) {
  selectedItem.value = item
  router.push({ query: currentQuery() })
}

// ── Edit modal ───────────────────────────────────────────────────────────────
function openAddModal() {
  Object.assign(itemForm, { open: true, item: null, initialName: '', initialNameEn: '' })
}

function openEditModal(item) {
  Object.assign(itemForm, { open: true, item, initialName: '', initialNameEn: '' })
}

function onItemSaved(item) {
  const isEditing = !!itemForm.item
  const exists = items.value.some(i => i.id === item.id)
  items.value = exists
    ? items.value.map(i => i.id === item.id ? item : i)
    : [item, ...items.value]
  itemForm.open = false
  if (isEditing || !selectedItem.value || selectedItem.value.id === item.id) {
    selectedItem.value = item
  }
  if (!isEditing) selectItem(item)
}


// ── Watchers ─────────────────────────────────────────────────────────────────
watch(searchQ, (val) => {
  if (skipSearchWatch.value) { skipSearchWatch.value = false; return }
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    fetchItems(val)
    router.replace({ query: currentQuery() })
  }, 280)
})

watch(filters, () => {
  if (skipFiltersWatch.value) { skipFiltersWatch.value = false; return }
  fetchItems(searchQ.value)
  router.replace({ query: currentQuery() })
}, { deep: true })

watch(groupBy, () => {
  if (skipGroupWatch.value) { skipGroupWatch.value = false; return }
  router.replace({ query: currentQuery() })
})

watch(selectedType, (type) => {
  uiStore.setHeaderTitle(type?.name || '')
}, { immediate: true })

// Sync from URL on initial load and back-navigation
watch(
  () => [route.query.type, route.query.item, route.query.q, route.query.group, route.query.filters],
  async ([rawType, rawItem, rawQ, rawGroup, rawFilters]) => {
    const typeId = rawType ? Number(rawType) : null
    const itemId = rawItem ? Number(rawItem) : null
    const q = rawQ || ''

    if (!typeId) {
      selectedType.value = null
      selectedItem.value = null
      items.value = []
      if (Object.keys(filters.value).length) { skipFiltersWatch.value = true; filters.value = {} }
      if (groupBy.value) { skipGroupWatch.value = true; groupBy.value = null }
      return
    }

    if (selectedType.value?.id !== typeId) {
      const type = types.value.find(t => t.id === typeId)
      if (!type) return
      selectedType.value = type
      selectedItem.value = null
      const nextFilters = parseFilters(rawFilters)
      if (JSON.stringify(nextFilters) !== JSON.stringify(filters.value)) {
        skipFiltersWatch.value = true
        filters.value = nextFilters
      }
      const nextGroup = rawGroup || null
      if (groupBy.value !== nextGroup) { skipGroupWatch.value = true; groupBy.value = nextGroup }
      if (searchQ.value !== q) skipSearchWatch.value = true
      searchQ.value = q
      clearTimeout(searchTimer)
      for (const id of collectSuggestIds(type.fields)) suggestStore.ensure(id)
      await fetchItems(q)
    }

    selectedItem.value = itemId ? await resolveItem(itemId) : null
  }
)

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  await fetchTypes()
  const typeId = route.query.type ? Number(route.query.type) : null
  const itemId = route.query.item ? Number(route.query.item) : null
  const q = route.query.q || ''

  if (!typeId) return
  const type = types.value.find(t => t.id === typeId)
  if (!type) return

  selectedType.value = type
  for (const id of collectSuggestIds(type.fields)) suggestStore.ensure(id)
  if (q) { skipSearchWatch.value = true; searchQ.value = q }
  const initGroup = route.query.group || null
  if (initGroup) { skipGroupWatch.value = true; groupBy.value = initGroup }
  const initFilters = parseFilters(route.query.filters)
  if (Object.keys(initFilters).length) { skipFiltersWatch.value = true; filters.value = initFilters }

  await fetchItems(q)
  if (itemId) selectedItem.value = await resolveItem(itemId)
}

init()

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  uiStore.setHeaderTitle('')
})
</script>

<style scoped>
/* ── Outer: full-width flex column, manages height & overflow ── */
.handbook-outer {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 54px);
  overflow: hidden;
}

.handbook-outer--landing {
  height: auto;
  min-height: calc(100vh - 54px);
  overflow: visible;
}

/* ── Collection bar: truly full viewport width ── */
.handbook-col-bar {
  flex-shrink: 0;
  width: 100%;
}

/* ── Inner page: max-width centered ── */
.handbook-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 24px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.handbook-landing {
  flex: 1;
  min-height: 0;
}

/* ── Mobile collection grid (hidden on desktop) ── */
.handbook-type-grid {
  display: none;
}

/* ── Body: list + detail ── */
.handbook-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
  border-right: 1px solid var(--border);
  border-top: 1px solid var(--border);
}

/* Mobile back bar (hidden on desktop) */
.mobile-back-bar { display: none; }

.handbook-list {
  /* HandbookItemList handles its own width */
}

.handbook-detail {
  /* HandbookItemDetail fills remaining space */
}

/* ── Responsive ── */
@media (max-width: 760px) {
  .handbook-outer {
    height: auto;
    min-height: calc(100vh - 54px);
    overflow: visible;
  }

  .handbook-page {
    padding: 0 14px 14px;
  }

  .handbook-body {
    flex-direction: column;
    overflow: visible;
    border-radius: 8px;
  }
}

@media (max-width: 520px) {
  .handbook-outer {
    height: auto;
    overflow: visible;
  }

  .handbook-page {
    padding: 0 10px 10px;
  }

  /* Desktop type bar hidden on mobile — grid replaces it */
  .handbook-type-bar { display: none; }

  /* Mobile collection grid */
  .handbook-type-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 12px 0 10px;
  }

  .type-grid-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 14px 14px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.025);
    color: var(--text-1);
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: border-color 0.15s, background 0.15s;
  }
  .type-grid-card:hover {
    border-color: var(--card-accent, rgba(162,146,255,0.35));
    background: rgba(255,255,255,0.04);
  }
  .type-grid-icon {
    width: 24px;
    height: 24px;
    object-fit: contain;
    opacity: 0.85;
  }
  .type-grid-icon-placeholder {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(255,255,255,0.1);
  }
  .type-grid-name {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
  }
  .type-grid-count {
    font-size: 12px;
    color: var(--text-muted);
  }

  /* Body = hidden by default on mobile, panels shown by class */
  .handbook-body {
    display: block;
    border: none;
    border-radius: 0;
    background: transparent;
  }

  .mobile-back-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0 8px;
    flex-shrink: 0;
  }

  .mobile-back-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    border: none;
    background: none;
    color: var(--text-2);
    font-family: inherit;
    font-size: 13px;
    cursor: pointer;
    padding: 4px 0;
    flex-shrink: 0;
  }
  .mobile-back-btn:hover { color: var(--text-1); }

  .mobile-back-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* panel-types: show grid, hide body */
  .handbook-outer.panel-types .handbook-type-grid { display: grid; }
  .handbook-outer.panel-types .handbook-body { display: none; }

  /* panel-list: show list, hide detail, show back bar */
  .handbook-outer.panel-list .handbook-type-grid { display: none; }
  .handbook-outer.panel-list .handbook-body { display: block; }
  .handbook-outer.panel-list .mobile-back-bar { display: flex; }
  .handbook-outer.panel-list .handbook-detail { display: none; }
  .handbook-outer.panel-list .handbook-list {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    max-height: none;
    min-height: 0;
  }

  /* panel-detail: show detail, hide list, show back bar */
  .handbook-outer.panel-detail .handbook-type-grid { display: none; }
  .handbook-outer.panel-detail .handbook-body { display: block; }
  .handbook-outer.panel-detail .mobile-back-bar { display: flex; }
  .handbook-outer.panel-detail .handbook-list { display: none; }
  .handbook-outer.panel-detail .handbook-detail {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    max-height: none;
    min-height: 0;
  }
}
</style>
