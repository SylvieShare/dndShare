<template>
  <div class="handbook-outer" :class="[!selectedType ? 'handbook-outer--landing' : mobilePanel]">

    <!-- ── Collection bar: full viewport width ── -->
    <HandbookCollectionBar
      v-if="selectedType"
      :type="selectedType"
      :can-add="isAuth"
      :result-count="filteredItems.length"
      :has-more="hasMore"
      :filtered="isFiltered"
      :show-controls="false"
      class="handbook-col-bar"
      @add="openAddModal"
    />

    <!-- ── Inner: max-width centered ── -->
    <div class="handbook-page">

      <!-- ── Landing: shown when no type is selected ── -->
      <HandbookLanding
        v-if="!selectedType"
        class="handbook-landing"
        :source-version-id="sourceVersionId"
        @select-type="selectType"
        @update:source-version-id="sourceVersionId = $event"
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
            <img v-if="type.iconImageUrl" class="type-grid-icon" :src="type.iconImageUrl" alt="" aria-hidden="true" />
            <span v-else class="type-grid-icon-placeholder" aria-hidden="true"></span>
            <span class="type-grid-name">{{ type.name }}</span>
            <span v-if="type.count != null" class="type-grid-count">{{ type.count }}</span>
          </button>
        </div>

        <!-- ── Main content: list + detail ── -->
        <div class="handbook-body">

          <HandbookItemList
            :type="selectedType"
            :selected-item="selectedItem"
            :items="filteredItems"
            :loading="loading"
            :loading-more="loadingMore"
            :has-more="hasMore"
            :group-by="groupBy"
            :search="searchQ"
            :filters="filters"
            :filter-fields="filterFields"
            :filter-suggests="filterSuggests"
            :content-sources="contentSources"
            :content-source-ids="contentSourceIds"
            :filtered="isFiltered"
            show-controls
            class="handbook-list"
            @select="selectItem"
            @load-more="loadMore"
            @update:group-by="groupBy = $event"
            @update:search="searchQ = $event"
            @update:filters="filters = $event"
            @update:content-source-ids="contentSourceIds = $event"
          />

          <HandbookItemDetail
            :item="selectedItem"
            :type="selectedType"
            :can-edit="canEdit"
            class="handbook-detail"
            @touchstart="swipeBack.onTouchStart"
            @touchmove="swipeBack.onTouchMove"
            @touchend="swipeBack.onTouchEnd"
            @touchcancel="swipeBack.onTouchCancel"
            @edit="openEditModal"
          />
        </div>

      </template>
    </div>

    <ItemEditModal
      v-if="itemForm.open && selectedType"
      :type-id="selectedType.id"
      :type-name="selectedType.name"
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
import { contentSourcesApi } from '@/shared/api/contentSourcesApi'
import { useAccountStore } from '@/stores/account'
import { useItemTypesStore } from '@/stores/itemTypes'
import { useUiStore } from '@/stores/ui'
import { useSuggestStore } from '@/stores/suggest'
import { useGameContextStore } from '@/stores/gameContext'
import { createHeaderChip } from '@/shared/lib/appHeader'
import { collectSuggestIds, getSuggestId, walkFieldsWithPath } from '@/features/handbook/objects/lib/schemaFields'
import { useHandbookSwipeBack } from '@/features/handbook/composables/useHandbookSwipeBack'
import HandbookLanding from '@/features/handbook/pages/HandbookLanding'
import HandbookCollectionBar from '@/features/handbook/components/HandbookCollectionBar'
import HandbookItemList from '@/features/handbook/components/HandbookItemList'
import HandbookItemDetail from '@/features/handbook/components/HandbookItemDetail'
import ItemEditModal from '@/features/character-editor/components/ItemEditModal'

// ── Router ──────────────────────────────────────────────────────────────────
const route = useRoute()
const router = useRouter()
const headerOwner = String(route.name)

// ── Stores ──────────────────────────────────────────────────────────────────
const accountStore = useAccountStore()
const itemTypesStore = useItemTypesStore()
const suggestStore = useSuggestStore()
const uiStore = useUiStore()
const gameContextStore = useGameContextStore()

// ── State ────────────────────────────────────────────────────────────────────
const types = ref([])
const selectedType = ref(null)
const items = ref([])
const selectedItem = ref(null)
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(false)
const itemPageSize = 30
const groupedPageSize = 500
let itemOffset = 0
let itemsRequestSeq = 0
const searchQ = ref('')
const handbookContentSourcesStorageKey = 'dndshare.handbook.contentSourceIds'
const filters = ref({})
const contentSources = ref([])
const sourceVersionId = ref(null)
const contentSourceIds = ref(readStoredContentSourceIds())
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
  router.replace('/handbook')
}

function goBack() {
  if (mobilePanel.value === 'panel-detail') {
    selectedItem.value = null
    router.replace({ query: { ...route.query, item: undefined } })
  } else {
    goToLanding()
  }
}

const swipeBack = useHandbookSwipeBack(goBack, {
  enabled: () => mobilePanel.value === 'panel-detail',
})

// ── Suggest helpers ──────────────────────────────────────────────────────────
function getSuggests(suggestId) { return suggestStore.items(suggestId) || [] }

const filterFields = computed(() =>
  walkFieldsWithPath(selectedType.value?.fields || [])
    .filter(({ field }) => field.filter && field.type !== 'item')
    .map(({ field, path }) => ({ ...field, path: field.filter_path || path }))
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
  !!searchQ.value.trim() || Object.keys(filters.value).length > 0 || contentSourceIds.value.length > 0
)

function readStoredContentSourceIds() {
  try {
    const stored = JSON.parse(localStorage.getItem(handbookContentSourcesStorageKey) || '[]')
    return Array.isArray(stored)
      ? [...new Set(stored.map(Number).filter(Number.isFinite))]
      : []
  } catch {
    return []
  }
}

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
  if (sourceVersionId.value) q.sourceVersionId = sourceVersionId.value
  return q
}

// ── Data loading ─────────────────────────────────────────────────────────────
async function fetchTypes() {
  await Promise.all([itemTypesStore.ensureAll(), gameContextStore.ensure()])
  types.value = itemTypesStore.allTypes
}

function versionForType(type, requestedID = null) {
  const source = gameContextStore.sources.find(item => Number(item.id) === Number(type?.sourceId))
  const versions = source?.versions || []
  const requested = versions.find(version => Number(version.id) === Number(requestedID))
  if (requested) return requested.id
  const global = versions.find(version => Number(version.id) === Number(gameContextStore.sourceVersionId))
  return (global || versions[0])?.id || null
}

function filtersQuery() {
  const params = new URLSearchParams()
  if (Object.keys(filters.value).length) params.set('filters', JSON.stringify(filters.value))
  if (contentSourceIds.value.length) params.set('contentSourceIds', contentSourceIds.value.join(','))
  if (sourceVersionId.value) params.set('sourceVersionId', String(sourceVersionId.value))
  const query = params.toString()
  return query ? `&${query}` : ''
}

async function fetchContentSources(type) {
  if (type?.sourceId == null) {
    contentSources.value = []
    return
  }
  const typeId = type.id
  const res = sourceVersionId.value
    ? await contentSourcesApi.listForVersion(sourceVersionId.value)
    : await contentSourcesApi.listForSystem(type.sourceId)
  if (selectedType.value?.id === typeId) contentSources.value = res?.sources || []
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
    const pageSize = groupBy.value ? groupedPageSize : itemPageSize
    const fetchPage = async (pageOffset) => {
      const lq = `&limit=${pageSize}&offset=${pageOffset}`
      const url = q.trim()
        ? `/items/search?typeId=${selectedType.value.id}&q=${encodeURIComponent(q)}${lq}${fq}`
        : `/items?typeId=${selectedType.value.id}${lq}${fq}`
      return fetchGet(url)
    }
    const res = await fetchPage(offset)
    if (requestId !== itemsRequestSeq) return
    let next = res.items || []

    // A grouped catalogue must be complete: otherwise a group can silently
    // omit entries that happen to live beyond the first API page (the original
    // cause of missing kobolds in CR grouping). The API caps pages at 500, so
    // collect every page before calculating groups in the client.
    if (groupBy.value && !append) {
      let nextOffset = offset + next.length
      let lastPageSize = next.length
      while (lastPageSize === pageSize) {
        const page = (await fetchPage(nextOffset)).items || []
        if (requestId !== itemsRequestSeq) return
        next = [...next, ...page]
        nextOffset += page.length
        lastPageSize = page.length
      }
    }
    if (append) {
      const ids = new Set(items.value.map(i => i.id))
      items.value = [...items.value, ...next.filter(i => !ids.has(i.id))]
    } else {
      items.value = next
    }
    itemOffset = offset + next.length
    hasMore.value = !groupBy.value && next.length === pageSize
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
function selectType(type, requestedSourceVersionID = null) {
  selectedType.value = type
  sourceVersionId.value = versionForType(type, requestedSourceVersionID)
  selectedItem.value = null
  skipFiltersWatch.value = true
  filters.value = {}
  skipGroupWatch.value = true
  groupBy.value = null
  if (searchQ.value !== '') skipSearchWatch.value = true
  searchQ.value = ''
  clearTimeout(searchTimer)
  for (const id of collectSuggestIds(type.fields)) suggestStore.ensure(id)
  router.push({ query: currentQuery() })
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

watch(contentSourceIds, (ids) => {
  try {
    localStorage.setItem(handbookContentSourcesStorageKey, JSON.stringify(ids))
  } catch {
    // Filtering remains available when browser storage is unavailable.
  }
  fetchItems(searchQ.value)
}, { deep: true })

watch(groupBy, () => {
  if (skipGroupWatch.value) { skipGroupWatch.value = false; return }
  fetchItems(searchQ.value)
  router.replace({ query: currentQuery() })
})

watch(
  [selectedType, () => filteredItems.value.length, hasMore, isFiltered],
  ([type, resultCount, more, filtered]) => {
    const total = type?.count
    let chip = null
    if (type) {
      const countLabel = filtered
        ? `${resultCount}${more ? '+' : ''}${total != null ? ` из ${total}` : ''}`
        : (total ?? resultCount)
      chip = createHeaderChip(countLabel)
    }
    uiStore.setHeaderContext({
      title: type?.name || route.meta?.title || 'Справочник',
      chip,
    }, headerOwner)
  },
  { immediate: true },
)

watch([selectedType, sourceVersionId], ([type]) => {
  fetchContentSources(type)
}, { immediate: true })

// Sync from URL on initial load and back-navigation
watch(
  () => [route.query.type, route.query.item, route.query.q, route.query.group, route.query.filters, route.query.sourceVersionId],
  async ([rawType, rawItem, rawQ, rawGroup, rawFilters, rawSourceVersionID]) => {
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

    const type = types.value.find(t => t.id === typeId)
    if (!type) return
    const nextSourceVersionID = versionForType(type, rawSourceVersionID)
    if (selectedType.value?.id !== typeId || Number(sourceVersionId.value) !== Number(nextSourceVersionID)) {
      selectedType.value = type
      sourceVersionId.value = nextSourceVersionID
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
  sourceVersionId.value = versionForType(type, route.query.sourceVersionId)
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
  uiStore.clearHeaderContext(headerOwner)
})
</script>

<style scoped src="./styles/ViewHandbook.css"></style>

<style scoped>
@media (max-width: 640px) {
  .handbook-col-bar :deep(.col-type-name),
  .handbook-col-bar :deep(.col-type-count) {
    display: none;
  }
}
</style>
