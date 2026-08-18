<template>
  <div class="col-bar" :class="{ 'col-bar--controls-only': !showIdentity }">
  <div class="col-bar-inner">

    <!-- ── Left: back + identity ── -->
    <div v-if="showIdentity" class="col-bar-left">
      <RouterLink class="col-back-btn" to="/handbook">
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
          <path d="M10 13L5 8L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        К коллекциям
      </RouterLink>
      <span class="col-sep" aria-hidden="true"></span>
<span class="col-type-name">{{ type.name }}</span>
      <span v-if="filtered" class="col-type-count">{{ resultCount }}{{ hasMore ? '+' : '' }} из {{ type.count }}</span>
      <span v-else-if="type.count != null" class="col-type-count">{{ type.count }}</span>
      <button v-if="canAdd" class="col-add-btn" @click="$emit('add')">+ Добавить</button>
    </div>

    <!-- ── Right: search + group + filter ── -->
    <div class="col-bar-right">

      <div class="col-search-wrap">
        <svg class="col-search-icon" viewBox="0 0 16 16" fill="none">
          <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M10 10 L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <input
          :value="search"
          class="col-search"
          :placeholder="searchPlaceholder || `Поиск в коллекции «${type.name}»...`"
          @input="$emit('update:search', $event.target.value)"
        />
      </div>

      <div v-if="visibleFilterFields.length" class="col-filter-wrap">
        <button
          ref="filterBtnRef"
          class="col-filter-btn"
          :class="{ active: filterOpen || activeFilterCount > 0 }"
          @click="filterOpen = !filterOpen"
        >
          <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
            <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span v-if="activeFilterCount" class="col-filter-count">{{ activeFilterCount }}</span>
        </button>

        <BasePopover v-model:open="filterOpen" :anchor="filterBtnRef" placement="bottom-end" :min-width="300">
          <div class="col-filter-body">
          <div class="col-filter-head">
            <span class="col-filter-head-title">Фильтр</span>
            <button v-if="activeFilterCount" class="col-filter-clear" @click="clearSchemaFilters">Сбросить</button>
          </div>
          <div v-for="field in visibleFilterFields" :key="field.path" class="col-filter-group">
            <template v-if="isBoolField(field)">
              <div class="col-filter-title">{{ field.name }}</div>
              <MultiToggle
                :model-value="boolFilterValue(field.path)"
                :options="boolFilterOptions"
                :neutral-value="'any'"
                block
                @update:model-value="setBoolFilter(field.path, $event)"
              />
            </template>
            <template v-else>
              <div class="col-filter-title">{{ field.name }}</div>
              <div v-if="hasFilterValues(field)" class="col-filter-options">
                <button
                  v-for="opt in filterValueOptions(field)"
                  :key="opt.value"
                  class="col-filter-chip"
                  :class="{ active: isSelected(field.path, opt.value) }"
                  @click="toggleValue(field.path, opt.value)"
                >{{ opt.label }}</button>
              </div>
              <div v-else-if="field.type === 'suggest' || field.type === 'suggest_array'" class="col-filter-options">
                <button
                  v-for="opt in suggestOptions(field)"
                  :key="opt.id"
                  class="col-filter-chip"
                  :class="{ active: isSelected(field.path, opt.id) }"
                  @click="toggleValue(field.path, opt.id)"
                >{{ opt.value }}</button>
              </div>
            </template>
          </div>
          </div>
        </BasePopover>
      </div>

      <div v-if="contentSources.length || contentSourceIds.length" class="col-filter-wrap">
        <button
          ref="contentSourceBtnRef"
          class="col-filter-btn"
          :class="{ active: contentSourceFilterOpen || activeContentSourceCount > 0 }"
          title="Фильтр по источникам"
          aria-label="Фильтр по источникам"
          @click="contentSourceFilterOpen = !contentSourceFilterOpen"
        >
          <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
            <path d="M3 2.5h8.5A1.5 1.5 0 0 1 13 4v9.5l-3.5-2-3.5 2V4A1.5 1.5 0 0 0 4.5 2.5H3Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
          </svg>
          <span v-if="activeContentSourceCount" class="col-filter-count">{{ activeContentSourceCount }}</span>
        </button>

        <BasePopover v-model:open="contentSourceFilterOpen" :anchor="contentSourceBtnRef" placement="bottom-end" :min-width="300">
          <div class="col-filter-body">
          <div class="col-filter-head">
            <span class="col-filter-head-title">Источники</span>
            <button v-if="activeContentSourceCount" class="col-filter-clear" @click="clearContentSourceFilter">Сбросить</button>
          </div>
          <div v-if="contentSources.length" class="col-filter-group">
            <div class="col-filter-title">Источники</div>
            <div class="col-filter-options">
              <button
                v-for="source in contentSources"
                :key="source.id"
                class="col-filter-chip"
                :class="{ active: contentSourceSelected(source.id) }"
                :title="source.description || source.name"
                @click="toggleContentSource(source.id)"
              >{{ source.name }}</button>
            </div>
          </div>
          </div>
        </BasePopover>
      </div>

    </div>
  </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { getSuggestId } from '@/features/handbook/objects/lib/schemaFields'
import { fetchGet } from '@/shared/api/http'
import { BasePopover } from '@sylvieshare/share-ui'
import { MultiToggle } from '@sylvieshare/share-ui'

const boolFilterOptions = [
  { value: 'any', label: 'Не важно' },
  { value: 'true', label: 'Да' },
  { value: 'false', label: 'Нет' },
]

const props = defineProps({
  type: { type: Object, required: true },
  search: { type: String, default: '' },
  groupBy: { type: String, default: null },
  filters: { type: Object, default: () => ({}) },
  filterFields: { type: Array, default: () => [] },
  filterSuggests: { type: Object, default: () => ({}) },
  contentSources: { type: Array, default: () => [] },
  contentSourceIds: { type: Array, default: () => [] },
  canAdd: { type: Boolean, default: false },
  resultCount: { type: Number, default: 0 },
  hasMore: { type: Boolean, default: false },
  filtered: { type: Boolean, default: false },
  showIdentity: { type: Boolean, default: true },
  searchPlaceholder: { type: String, default: '' },
})

const emit = defineEmits(['add', 'update:search', 'update:group-by', 'update:filters', 'update:content-source-ids'])

const filterOpen = ref(false)
const filterBtnRef = ref(null)
const contentSourceFilterOpen = ref(false)
const contentSourceBtnRef = ref(null)
const itemFilterOptions = ref({})

watch(() => props.filterFields, async fields => {
  const next = {}
  await Promise.all((fields || []).filter(field => field.filter_item_type).map(async field => {
    const response = await fetchGet(`/items?typeId=${field.filter_item_type}&limit=500`).catch(() => null)
    next[field.path] = (response?.items || []).filter(item => !item.parentId).map(item => ({ value: item.id, label: item.name }))
  }))
  itemFilterOptions.value = next
}, { immediate: true })

const activeFilterCount = computed(() =>
  Object.values(props.filters).reduce((sum, val) => {
    if (Array.isArray(val)) return sum + val.length
    return val == null ? sum : sum + 1
  }, 0)
)

const activeContentSourceCount = computed(() => props.contentSourceIds.length)

const visibleFilterFields = computed(() => props.filterFields.filter(hasAvailableOptions))

function isBoolField(f) { return f?.type === 'bool' || f?.type === 'boolean' }
function hasFilterValues(f) { return Array.isArray(f?.filter_values) && f.filter_values.length > 0 }
function suggestOptions(f) { return props.filterSuggests[getSuggestId(f)] || [] }
function hasAvailableOptions(f) {
  return isBoolField(f) || hasFilterValues(f) || itemFilterOptions.value[f.path]?.length > 0 ||
    ((f?.type === 'suggest' || f?.type === 'suggest_array') && suggestOptions(f).length > 0)
}

function filterValueOptions(f) {
  if (itemFilterOptions.value[f.path]?.length) return itemFilterOptions.value[f.path]
  const labels = f.filter_labels || {}
  return (f.filter_values || []).map(v => ({
    value: v,
    label: Object.prototype.hasOwnProperty.call(labels, v) ? labels[v] : String(v),
  }))
}

function isSelected(key, id) { return (props.filters[key] || []).includes(id) }

function emitFilter(key, value) {
  const next = { ...props.filters }
  if (value == null || (Array.isArray(value) && value.length === 0)) delete next[key]
  else next[key] = value
  emit('update:filters', next)
}

function toggleValue(key, id) {
  const cur = [...(props.filters[key] || [])]
  const idx = cur.indexOf(id)
  if (idx === -1) cur.push(id)
  else cur.splice(idx, 1)
  emitFilter(key, cur)
}

function boolFilterValue(key) {
  const v = props.filters[key]
  if (v === true) return 'true'
  if (v === false) return 'false'
  return 'any'
}

function setBoolFilter(key, value) {
  if (value === 'true') emitFilter(key, true)
  else if (value === 'false') emitFilter(key, false)
  else emitFilter(key, null)
}

function contentSourceSelected(id) {
  return props.contentSourceIds.some((value) => String(value) === String(id))
}

function toggleContentSource(id) {
  const ids = contentSourceSelected(id)
    ? props.contentSourceIds.filter((value) => String(value) !== String(id))
    : [...props.contentSourceIds, id]
  emit('update:content-source-ids', ids)
}

function clearSchemaFilters() {
  emit('update:filters', {})
}

function clearContentSourceFilter() {
  emit('update:content-source-ids', [])
}
</script>

<style scoped src="./styles/HandbookCollectionBar.css"></style>
