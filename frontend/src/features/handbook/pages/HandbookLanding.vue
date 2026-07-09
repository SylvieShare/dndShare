<template>
  <div class="hb-landing">

    <!-- ── Left: source sidebar ── -->
    <aside class="hb-sidebar">
      <div class="hb-sidebar-header">
        <span class="hb-sidebar-label">Система</span>
        <span class="hb-sidebar-divider" aria-hidden="true"></span>
        <span class="hb-sidebar-label hb-sidebar-label--badge">Source</span>
      </div>
      <div class="hb-source-list">
        <button
          v-for="src in sources"
          :key="src.id"
          class="hb-source-item"
          :class="{ active: src.id === selectedSourceId }"
          @click="selectedSourceId = src.id"
        >
          <span class="hb-source-name">{{ src.name }}</span>
          <span v-if="src.version" class="hb-source-version">{{ src.version }}</span>
        </button>
      </div>
    </aside>

    <!-- ── Right: content ── -->
    <div class="hb-content">
      <div v-if="selectedSource" class="hb-content-inner">

        <!-- Header -->
        <div class="hb-header">
          <h1 class="hb-title">Справочник</h1>
          <p class="hb-subtitle">
            {{ selectedSource.name }}
            <template v-if="selectedSource.version">· {{ selectedSource.version }}</template>
            · {{ itemTypes.length }} коллекций
            · {{ selectedSource.countItems.toLocaleString('ru') }} записей
          </p>
        </div>

        <!-- Collections section -->
        <div class="hb-section-header">
          <span class="hb-section-title">Коллекции</span>
          <span class="hb-section-count">{{ itemTypes.length }}</span>
          <span class="hb-section-meta">· ядро {{ selectedSource.name }}<template v-if="selectedSource.version"> ({{ selectedSource.version }})</template> · только чтение</span>
        </div>

        <div v-if="loadingTypes" class="hb-loading">Загрузка…</div>
        <div v-else class="hb-collections-grid">
          <button
            v-for="type in itemTypes"
            :key="type.id"
            class="hb-collection-card"
            :class="{ 'hb-collection-card--wide': type.important }"
            :style="cardStyle(type)"
            @click="$emit('select-type', type)"
          >
            <div class="hb-card-top">
              <span class="hb-card-name">{{ type.name }}</span>
              <p v-if="type.description" class="hb-card-desc">{{ type.description }}</p>
            </div>
            <div class="hb-card-bottom">
              <span class="hb-card-count">
                <strong class="hb-card-count-num">{{ type.countItems }}</strong>
                <span class="hb-card-count-label"> записей</span>
              </span>
            </div>
            <span
              v-if="type.svg"
              class="hb-card-icon"
              aria-hidden="true"
              v-html="type.svg"
              :style="type.color ? { color: type.color } : {}"
            ></span>
          </button>
        </div>

        <!-- Dictionaries section -->
        <div class="hb-section-header">
          <span class="hb-section-title">Словари</span>
          <span class="hb-section-count">{{ suggestTypes.length }}</span>
          <span class="hb-section-meta">· справочные таблицы — типы, школы, размеры</span>
        </div>

        <div v-if="loadingDicts" class="hb-loading">Загрузка…</div>
        <div v-else class="hb-dicts-grid">
          <router-link
            v-for="dict in suggestTypes"
            :key="dict.id"
            class="hb-dict-card"
            :style="dict.color ? { '--dict-color': dict.color } : {}"
            :to="`/handbook/dictionary?type=${dict.id}`"
          >
            <div
              class="hb-dict-icon"
              :style="dict.color ? { background: dict.color + '1F', color: dict.color, borderColor: dict.color + '59' } : {}"
            >
              <span v-if="dict.svg" class="hb-dict-icon-svg" aria-hidden="true" v-html="dict.svg"></span>
              <span v-else class="hb-dict-icon-placeholder" aria-hidden="true"></span>
            </div>
            <div class="hb-dict-info">
              <span class="hb-dict-name">{{ dict.name }}</span>
              <span v-if="dict.countItems" class="hb-dict-count">{{ dict.countItems }} записей</span>
            </div>
            <svg class="hb-dict-arrow" viewBox="0 0 16 16" fill="none">
              <path d="M6 12L10 8L6 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </router-link>
        </div>

      </div>

      <div v-else class="hb-loading">Загрузка…</div>
    </div>

  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { fetchGet } from '@/shared/api/http'
import { useItemTypesStore } from '@/stores/itemTypes'

const itemTypesStore = useItemTypesStore()

defineEmits(['select-type'])

const sources = ref([])
const selectedSourceId = ref(null)
const itemTypes = ref([])
const suggestTypes = ref([])
const loadingTypes = ref(false)
const loadingDicts = ref(false)

const selectedSource = computed(() => sources.value.find(s => s.id === selectedSourceId.value) || null)

function cardStyle(type) {
  if (!type.color) return {}
  return { '--card-color': type.color }
}

async function fetchSources() {
  const res = await fetchGet('/sources')
  sources.value = res?.sources || []
  if (sources.value.length && !selectedSourceId.value) {
    selectedSourceId.value = sources.value[0].id
  }
}

async function fetchTypesForSource(sourceId) {
  loadingTypes.value = true
  loadingDicts.value = true
  try {
    const [types, dictsRes] = await Promise.all([
      itemTypesStore.ensureBySource(sourceId),
      fetchGet(`/suggest/types?sourceId=${sourceId}`),
    ])
    itemTypes.value = types
    suggestTypes.value = dictsRes?.items || []
  } finally {
    loadingTypes.value = false
    loadingDicts.value = false
  }
}

watch(selectedSourceId, (id) => {
  if (id != null) fetchTypesForSource(id)
}, { immediate: false })

fetchSources()
</script>

<style scoped>
.hb-landing {
  display: flex;
  min-height: calc(100vh - 54px);
  max-width: 1400px;
  margin: 0 auto;
  box-sizing: border-box;
}

/* ── Sidebar ── */
.hb-sidebar {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  border-left: 1px solid var(--border);
  background: var(--bg);
  padding: 20px 0;
  display: flex;
  flex-direction: column;
}

.hb-sidebar-header {
  display: flex;
  justify-content: space-between;
  padding: 0 16px 10px;
}

.hb-sidebar-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  flex-shrink: 0;
}

.hb-sidebar-label--badge {
  border: 1px solid var(--border-strong);
  border-radius: 5px;
  padding: 1px 6px;
}

.hb-sidebar-divider {
  flex: 1;
  height: 1px;
  background: var(--border);
  margin: 0 8px;
  align-self: center;
}

.hb-source-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 8px;
}

.hb-source-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  text-align: left;
  transition: background 0.13s, color 0.13s;
}

.hb-source-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-1);
}

.hb-source-item.active {
  background: rgba(106, 100, 216, 0.2);
  color: #fff;
}

.hb-source-name {
  font-weight: 600;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hb-source-version {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 5px;
  border: 1px solid var(--border-strong);
  background: transparent;
  color: var(--text-muted);
}

.hb-source-item.active .hb-source-version {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: rgba(255, 255, 255, 0.75);
}

/* ── Content ── */
.hb-content {
  flex: 1;
  min-width: 0;
  padding: 24px 28px;
  overflow-y: auto;
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
}

.hb-content-inner {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Header */
.hb-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hb-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-1);
  margin: 0;
}

.hb-subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
}

/* Section header */
.hb-section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
  margin-left: -28px;
  margin-right: -28px;
  padding-top: 16px;
  padding-left: 28px;
  padding-right: 28px;
  border-top: 1px solid var(--border);
}

.hb-section-title {
  font-family: var(--font-display);
  font-size: 25px;
  font-weight: 600;
  color: var(--text-1);
}

.hb-section-count {
  font-size: 12px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-2);
}

.hb-section-meta {
  font-size: 12px;
  color: var(--text-muted);
}

/* Collections grid */
.hb-collections-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.hb-collection-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 18px 18px 16px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-1);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  min-height: 130px;
  overflow: hidden;
  transition: box-shadow 0.15s;
}

.hb-collection-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 72% 35%,
    color-mix(in srgb, var(--accent) 10%, transparent) 0%,
    transparent 65%
  );
  pointer-events: none;
}

.hb-collection-card:hover {
  box-shadow: 0 0 0 1px var(--card-color, var(--border-strong));
}

.hb-collection-card--wide {
  grid-column: span 2;
  min-height: 170px;
}

/* Card top: name + description */
.hb-card-top {
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
  z-index: 1;
}

.hb-card-name {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  line-height: 1.2;
}

.hb-collection-card--wide .hb-card-name {
  font-size: 28px;
}

.hb-card-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
  margin: 0;
}

/* Card bottom: count */
.hb-card-bottom {
  position: relative;
  z-index: 1;
  margin-top: auto;
  padding-top: 12px;
}

.hb-card-count {
  display: flex;
  align-items: baseline;
  gap: 4px;
  color: var(--card-color, var(--accent));
}

.hb-card-count-num {
  font-family: var(--font-display);
  font-size: 38px;
  font-weight: 600;
  line-height: 1;
  color: var(--card-color, var(--accent));
}

.hb-collection-card--wide .hb-card-count-num {
  font-size: 48px;
}

.hb-card-count-label {
  font-size: 12px;
  color: var(--text-muted);
}

.hb-card-icon {
  position: absolute;
  right: -6px;
  top: 50%;
  transform: translateY(-60%);
  width: 110px;
  height: 110px;
  opacity: 0.12;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hb-card-icon :deep(svg) {
  width: 110px;
  height: 110px;
}

.hb-collection-card--wide .hb-card-icon {
  width: 140px;
  height: 140px;
}

.hb-collection-card--wide .hb-card-icon :deep(svg) {
  width: 140px;
  height: 140px;
}

/* Dicts grid */
.hb-dicts-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.hb-dict-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-1);
  text-decoration: none;
  overflow: hidden;
  transition: border-color 0.15s;
}

.hb-dict-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    45deg,
    var(--border) 0,
    var(--border) 1px,
    transparent 0,
    transparent 50%
  );
  background-size: 12px 12px;
  opacity: 0.5;
  pointer-events: none;
}

.hb-dict-card:hover {
  border-color: var(--dict-color, var(--border-strong));
}

.hb-dict-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--border);
  border: 1px solid transparent;
}

.hb-dict-icon-svg {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
}

.hb-dict-icon-svg :deep(svg) {
  width: 18px;
  height: 18px;
}

.hb-dict-icon-placeholder {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
}

.hb-dict-info {
  flex: 1;
  min-width: 0;
}

.hb-dict-name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.hb-dict-count {
  font-size: 11px;
  color: #67677a;
  display: block;
  margin-top: 1px;
}

.hb-dict-arrow {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--text-muted);
}

.hb-loading {
  color: var(--text-muted);
  font-size: 13px;
  padding: 12px 0;
}

/* ── Responsive ── */
@media (max-width: 1100px) {
  .hb-collections-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .hb-dicts-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 760px) {
  .hb-landing {
    flex-direction: column;
  }
  .hb-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border);
    padding: 12px 0;
  }
  .hb-source-list {
    flex-direction: row;
    flex-wrap: wrap;
    padding: 0 12px;
    gap: 6px;
  }
  .hb-sidebar-header {
    display: none;
  }
  .hb-content {
    padding: 16px;
  }
  .hb-section-header {
    margin-left: -16px;
    margin-right: -16px;
    padding-left: 16px;
    padding-right: 16px;
  }
  .hb-collections-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .hb-dicts-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 520px) {
  .hb-collections-grid {
    grid-template-columns: 1fr 1fr;
  }
  .hb-collection-card--wide {
    grid-column: span 2;
  }
  .hb-dicts-grid {
    grid-template-columns: 1fr;
  }
}
</style>
