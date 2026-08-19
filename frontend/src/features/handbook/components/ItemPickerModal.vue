<template>
  <AppModalFrame
    fullscreen
    :title="title"
    :subtitle="itemType?.count ?? ''"
    :padded="false"
    :body-scroll="false"
    :z-index="zIndex"
    @close="$emit('close')"
  >
    <div class="picker-modal">

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
            :search="searchQ"
            :filters="filters"
            :filter-fields="filterFields"
            :filter-suggests="filterSuggests"
            :content-sources="visibleContentSources"
            :content-source-ids="contentSourceIds"
            :filtered="isFiltered"
            :search-placeholder="searchPlaceholder"
            show-controls
            class="picker-list"
            @select="selectedItem = $event"
            @load-more="loadMore"
            @update:group-by="groupBy = $event"
            @update:search="searchQ = $event"
            @update:filters="filters = $event"
            @update:content-source-ids="contentSourceIds = $event"
          />
          <HandbookItemDetail
            :item="selectedItem"
            :type="itemType"
            :can-edit="false"
            class="picker-detail"
          />
        </div>

        <div class="picker-footer">
          <span v-if="selectedItem && selectedEligibility.eligible" class="picker-footer-name">{{ selectedItem.name }}</span>
          <span v-else-if="selectedItem" class="picker-footer-ineligible">
            Не выполнено: {{ selectedEligibility.reasons.join(', ') || selectedEligibility.text || 'требование черты' }}
          </span>
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
            :disabled="!selectedItem || !selectedEligibility.eligible"
            @click="pick"
          >
            + Добавить<span v-if="allowQuantity && quantity > 1"> ×{{ quantity }}</span>
          </button>
        </div>

        <ItemEditModal
          v-if="createOpen && activeTypeId != null"
          :type-id="activeTypeId"
          :show-name-en="createShowNameEn"
          @close="createOpen = false"
          @saved="onItemCreated"
        />

    </div>
  </AppModalFrame>
</template>

<script setup>
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { fetchGet } from '@/shared/api/http'
import { contentScopeQuery, contentSourcesApi, normalizeContentSourceSettings } from '@/shared/api/contentSourcesApi'
import HandbookItemDetail from '@/features/handbook/components/HandbookItemDetail'
import SvgIcon from '@/shared/ui/SvgIcon'
import HandbookItemList from '@/features/handbook/components/HandbookItemList'
import ItemEditModal from '@/features/character-editor/components/ItemEditModal'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { collectSuggestIds, getSuggestId, walkFieldsWithPath } from '@/features/handbook/objects/lib/schemaFields'
import { useItemTypesStore } from '@/stores/itemTypes'
import { useSuggestStore } from '@/stores/suggest'

const PAGE_SIZE = 30
const GROUPED_PAGE_SIZE = 500

const props = defineProps({
  itemTypeIds: { type: Array, required: true },
  title: { type: String, default: 'Выбрать' },
  searchPlaceholder: { type: String, default: 'Поиск...' },
  excludeItems: { type: Array, default: () => [] },
  allowQuantity: { type: Boolean, default: false },
  createShowNameEn: { type: Boolean, default: false },
  itemEligibility: { type: Function, default: null },
  zIndex: { type: Number, default: 3000 },
  contentSources: { type: Object, default: null },
  sourceVersionId: { type: [Number, String], default: null },
})

const emit = defineEmits(['close', 'pick'])
const quantity = ref(1)
const charCtx = inject('charCtx', null)
const createWizard = inject('createWizard', null)
const effectiveContentSources = computed(() =>
  props.contentSources || createWizard?.state?.contentSources || charCtx?.contentSources || null)
const effectiveSourceVersionId = computed(() =>
  props.sourceVersionId ?? createWizard?.sourceVersionId?.value ?? createWizard?.sourceVersionId ?? charCtx?.sourceVersionId ?? null)

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
const filters = ref({})
const availableContentSources = ref([])
const contentSourceIds = ref([])
const createOpen = ref(false)
let offset = 0
let reqSeq = 0
let searchTimer = null

const excludeSet = computed(() =>
  new Set(props.excludeItems.map(i => i?.id ?? i).filter(x => x != null).map(String))
)

const suggestStore = useSuggestStore()
const filterFields = computed(() =>
  walkFieldsWithPath(itemType.value?.fields || [])
    .filter(({ field }) => field.filter && field.type !== 'item')
    .map(({ field, path }) => ({ ...field, path: field.filter_path || path }))
)
const filterSuggests = computed(() => {
  const map = {}
  for (const field of filterFields.value) {
    const suggestId = getSuggestId(field)
    if (suggestId != null) map[suggestId] = suggestStore.items(suggestId) || []
  }
  return map
})
const contentSourceSettings = computed(() => normalizeContentSourceSettings(effectiveContentSources.value))
const visibleContentSources = computed(() => {
  if (contentSourceSettings.value.mode !== 'selected') return availableContentSources.value
  const allowed = new Set(contentSourceSettings.value.ids.map(String))
  return availableContentSources.value.filter(source => allowed.has(String(source.id)))
})
const isFiltered = computed(() =>
  !!searchQ.value.trim() || Object.keys(filters.value).length > 0 || contentSourceIds.value.length > 0
)

const filteredItems = computed(() =>
  [...items.value]
    .filter(i => !excludeSet.value.has(String(i.id)))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'))
)

const selectedEligibility = computed(() => {
  if (!selectedItem.value || !props.itemEligibility) return { eligible: true, reasons: [], text: '' }
  return props.itemEligibility(selectedItem.value) || { eligible: true, reasons: [], text: '' }
})

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
  for (const sid of collectSuggestIds(type.fields || [])) suggestStore.ensure(sid)
}

async function fetchContentSources() {
  const typeId = activeTypeId.value
  const response = effectiveSourceVersionId.value != null
    ? await contentSourcesApi.listForVersion(effectiveSourceVersionId.value).catch(() => null)
    : await contentSourcesApi.listForSystem(itemType.value?.sourceId).catch(() => null)
  if (activeTypeId.value === typeId) availableContentSources.value = response?.sources || []
}

function setActiveType(id) {
  if (id === activeTypeId.value) return
  activeTypeId.value = id
  searchQ.value = ''
  groupBy.value = null
  filters.value = {}
  contentSourceIds.value = []
  selectedItem.value = null
  items.value = []
  ensureSuggestsForType(itemType.value)
  fetchContentSources()
  fetchItems('')
}

function filtersQuery() {
  const params = new URLSearchParams(contentScopeQuery(effectiveContentSources.value, effectiveSourceVersionId.value).replace(/^&/, ''))
  if (Object.keys(filters.value).length) params.set('filters', JSON.stringify(filters.value))
  if (contentSourceIds.value.length) {
    const selected = contentSourceSettings.value.mode === 'selected'
      ? contentSourceIds.value.filter(id => contentSourceSettings.value.ids.some(allowed => String(allowed) === String(id)))
      : contentSourceIds.value
    params.set('contentSourceIds', selected.join(','))
  }
  const raw = params.toString()
  return raw ? `&${raw}` : ''
}

async function fetchItems(q, append = false) {
  if (!activeTypeId.value) return
  if (append && (!hasMore.value || loading.value || loadingMore.value)) return
  const id = ++reqSeq
  const off = append ? offset : 0
  if (append) loadingMore.value = true
  else { loading.value = true; hasMore.value = false }
  try {
    const pageSize = groupBy.value ? GROUPED_PAGE_SIZE : PAGE_SIZE
    const fq = filtersQuery()
    const fetchPage = (pageOffset) => {
      const lq = `&limit=${pageSize}&offset=${pageOffset}`
      const url = q.trim()
        ? `/items/search?typeId=${activeTypeId.value}&q=${encodeURIComponent(q.trim())}${lq}${fq}`
        : `/items?typeId=${activeTypeId.value}${lq}${fq}`
      return fetchGet(url)
    }
    const res = await fetchPage(off)
    if (id !== reqSeq) return
    let next = res?.items || []
    if (groupBy.value && !append) {
      let nextOffset = off + next.length
      let lastPageSize = next.length
      while (lastPageSize === pageSize) {
        const page = (await fetchPage(nextOffset))?.items || []
        if (id !== reqSeq) return
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
    offset = off + next.length
    hasMore.value = !groupBy.value && next.length === pageSize
  } finally {
    if (id === reqSeq) { loading.value = false; loadingMore.value = false }
  }
}

function loadMore() { fetchItems(searchQ.value, true) }

watch(searchQ, (val) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchItems(val), 280)
})

watch(filters, () => {
  selectedItem.value = null
  fetchItems(searchQ.value)
}, { deep: true })

watch(contentSourceIds, () => {
  selectedItem.value = null
  fetchItems(searchQ.value)
}, { deep: true })

watch(groupBy, () => {
  selectedItem.value = null
  fetchItems(searchQ.value)
})

watch([effectiveContentSources, effectiveSourceVersionId], () => {
  selectedItem.value = null
  items.value = []
  contentSourceIds.value = []
  fetchContentSources()
  fetchItems(searchQ.value)
}, { deep: true })

function pick() {
  if (!selectedItem.value || !selectedEligibility.value.eligible) return
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
  await fetchContentSources()
  fetchItems('')
})

onBeforeUnmount(() => clearTimeout(searchTimer))
</script>

<style scoped src="./styles/ItemPickerModal.css"></style>
