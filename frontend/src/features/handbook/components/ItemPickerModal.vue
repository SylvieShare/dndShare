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
    <template #header-actions>
      <div class="picker-header-controls">
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
      </div>
    </template>

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
import { computed, inject, onMounted, ref, watch } from 'vue'
import { fetchGet } from '@/shared/api/http'
import { contentScopeQuery } from '@/shared/api/contentSourcesApi'
import HandbookItemDetail from '@/features/handbook/components/HandbookItemDetail'
import SvgIcon from '@/shared/ui/SvgIcon'
import HandbookItemList from '@/features/handbook/components/HandbookItemList'
import ItemEditModal from '@/features/character-editor/components/ItemEditModal'
import { AppModalFrame } from '@sylvieshare/share-ui'
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
    const sourceQ = contentScopeQuery(effectiveContentSources.value, effectiveSourceVersionId.value)
    const url = q.trim()
      ? `/items/search?typeId=${activeTypeId.value}&q=${encodeURIComponent(q.trim())}${lq}${sourceQ}`
      : `/items?typeId=${activeTypeId.value}${lq}${sourceQ}`
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

watch([effectiveContentSources, effectiveSourceVersionId], () => {
  selectedItem.value = null
  items.value = []
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
  fetchItems('')
})
</script>

<style scoped src="./styles/ItemPickerModal.css"></style>
