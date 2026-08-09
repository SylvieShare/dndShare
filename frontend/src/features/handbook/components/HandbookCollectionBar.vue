<template>
  <div class="col-bar">
  <div class="col-bar-inner">

    <!-- ── Left: back + identity ── -->
    <div class="col-bar-left">
      <button class="col-back-btn" @click="$emit('back')">
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
          <path d="M10 13L5 8L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        К коллекциям
      </button>
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
          placeholder="Поиск..."
          @input="$emit('update:search', $event.target.value)"
        />
      </div>

      <div v-if="groupFields.length" class="col-group">
        <span class="col-group-label">ГРУППИРОВКА</span>
        <span class="col-group-sep" aria-hidden="true"></span>
        <button
          v-for="f in groupFields"
          :key="f.path"
          class="col-group-btn"
          :class="{ active: groupBy === f.path }"
          @click="$emit('update:group-by', groupBy === f.path ? null : f.path)"
        >{{ f.nameShort || f.name }}</button>
      </div>

      <div v-if="filterFields.length" class="col-filter-wrap">
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
            <button v-if="activeFilterCount" class="col-filter-clear" @click="$emit('update:filters', {})">Сбросить</button>
          </div>
          <div v-for="field in filterFields" :key="field.path" class="col-filter-group">
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

    </div>
  </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { getSuggestId, walkFieldsWithPath } from '@/features/handbook/objects/lib/schemaFields'
import BasePopover from '@/shared/ui/BasePopover.vue'
import MultiToggle from '@/shared/ui/MultiToggle.vue'

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
  canAdd: { type: Boolean, default: false },
  resultCount: { type: Number, default: 0 },
  hasMore: { type: Boolean, default: false },
  filtered: { type: Boolean, default: false },
})

const emit = defineEmits(['back', 'add', 'update:search', 'update:group-by', 'update:filters'])

const filterOpen = ref(false)
const filterBtnRef = ref(null)

const groupFields = computed(() =>
  walkFieldsWithPath(props.type?.fields || [])
    .filter(({ field }) => field.group)
    .map(({ field, path }) => ({ ...field, path }))
)

const activeFilterCount = computed(() =>
  Object.values(props.filters).reduce((sum, val) => {
    if (Array.isArray(val)) return sum + val.length
    return val == null ? sum : sum + 1
  }, 0)
)

function isBoolField(f) { return f?.type === 'bool' || f?.type === 'boolean' }
function hasFilterValues(f) { return Array.isArray(f?.filter_values) && f.filter_values.length > 0 }
function suggestOptions(f) { return props.filterSuggests[getSuggestId(f)] || [] }

function filterValueOptions(f) {
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
</script>

<style scoped>
.col-bar {
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}

.col-bar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 24px;
  max-width: 1400px;
  margin: 0 auto;
  box-sizing: border-box;
}

/* ── Left ── */
.col-bar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex-shrink: 1;
}

.col-back-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  border: none;
  background: none;
  color: var(--text-2);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
  flex-shrink: 0;
  white-space: nowrap;
  transition: color 0.13s, background 0.13s;
}
.col-back-btn:hover { color: var(--text-1); background: color-mix(in srgb, var(--text-on-accent) 5%, transparent); }

.col-sep {
  width: 1px;
  height: 18px;
  background: var(--border);
  flex-shrink: 0;
}

.col-type-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
}
.col-type-icon :deep(svg) { width: 20px; height: 20px; }

.col-type-name {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-type-count {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--border);
  color: var(--text-2);
}

.col-add-btn {
  flex-shrink: 0;
  background: none;
  color: var(--text-2);
  border: 1px dashed var(--border);
  border-radius: 7px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.col-add-btn:hover { color: var(--text-1); border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }

/* ── Right ── */
.col-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Search */
.col-search-wrap {
  position: relative;
}
.col-search-icon {
  position: absolute;
  left: 9px;
  top: 50%;
  width: 14px;
  height: 14px;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--text-muted);
}
.col-search {
  width: 200px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-1);
  font-size: 13px;
  font-family: inherit;
  padding: 7px 10px 7px 30px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s, width 0.2s;
}
.col-search:focus { border-color: var(--accent); width: 260px; }
.col-search::placeholder { color: var(--text-muted); }

/* Group toggle */
.col-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--text-on-accent) 2%, transparent);
}
.col-group-label {
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--text-muted);
  white-space: nowrap;
}
.col-group-sep {
  width: 1px;
  height: 16px;
  background: var(--border);
  flex-shrink: 0;
}
.col-group-btn {
  padding: 5px 14px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  color: var(--text-muted);
  background: none;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.13s, background 0.13s;
}
.col-group-btn:hover { color: var(--text-2); }
.col-group-btn.active {
  color: var(--text-on-accent);
  background: var(--accent);
}

/* Filter button */
.col-filter-wrap { position: relative; }

.col-filter-btn {
  position: relative;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: var(--text-2);
  transition: border-color 0.15s, background 0.15s;
}
.col-filter-btn:hover,
.col-filter-btn.active {
  border-color: color-mix(in srgb, var(--accent-soft) 45%, transparent);
  background: color-mix(in srgb, var(--accent-soft) 12%, transparent);
  color: var(--text-1);
}

.col-filter-count {
  position: absolute;
  right: -4px;
  top: -5px;
  min-width: 15px;
  height: 15px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--accent);
  color: var(--text-on-accent);
  font-size: 10px;
  font-weight: 700;
  line-height: 15px;
  text-align: center;
}

/* Filter panel body (shell provided by BasePopover .app-dropdown) */
.col-filter-body {
  width: min(300px, calc(100vw - 32px));
  max-height: min(420px, calc(100vh - 180px));
  overflow: auto;
  padding: 6px;
}

.col-filter-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 9px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--border);
}
.col-filter-head-title { color: var(--text-1); font-size: 13px; font-weight: 700; }

.col-filter-group {
  padding: 9px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-on-accent) 2.5%, transparent);
}
.col-filter-group + .col-filter-group { margin-top: 8px; }

.col-filter-title {
  margin-bottom: 6px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.col-filter-title-toggle {
  width: 100%;
  margin-bottom: 0;
  border: none;
  background: none;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0;
  text-align: left;
}
.col-filter-title-toggle.active { color: var(--accent-soft); }

.col-filter-switch {
  width: 28px; height: 16px; flex-shrink: 0;
  border-radius: 999px; background: color-mix(in srgb, var(--text-on-accent) 10%, transparent);
  transition: background .12s;
}
.col-filter-switch::after {
  content: '';
  display: block;
  width: 10px; height: 10px;
  border-radius: 50%; background: var(--text-muted);
  margin: 3px 0 0 3px;
  transition: transform .12s, background .12s;
}
.col-filter-title-toggle.active .col-filter-switch { background: color-mix(in srgb, var(--accent-soft) 28%, transparent); }
.col-filter-title-toggle.active .col-filter-switch::after { transform: translateX(12px); background: var(--accent-soft); }

.col-filter-options { display: flex; flex-wrap: wrap; gap: 5px; }

.col-filter-chip {
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 8%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  color: var(--text-2);
  font-family: inherit;
  font-size: 11px;
  padding: 4px 9px;
  cursor: pointer;
  transition: background .12s, border-color .12s, color .12s;
}
.col-filter-chip:hover,
.col-filter-chip.active {
  border-color: color-mix(in srgb, var(--accent-soft) 35%, transparent);
  background: color-mix(in srgb, var(--accent-soft) 14%, transparent);
  color: var(--accent-soft);
}

.col-filter-clear {
  border: none; background: none;
  color: var(--text-muted); font-family: inherit; font-size: 11px;
  cursor: pointer; padding: 0;
}
.col-filter-clear:hover { color: var(--text-2); }

@media (max-width: 760px) {
  .col-bar { flex-direction: column; align-items: flex-start; padding-bottom: 8px; }
  .col-bar-right { width: 100%; flex-wrap: wrap; }
  .col-search { width: 100%; }
  .col-search:focus { width: 100%; }
  .col-search-wrap { flex: 1; min-width: 0; }
}
</style>
