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
          <span v-if="sourceVersionLabel(src)" class="hb-source-version">{{ sourceVersionLabel(src) }}</span>
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
            <template v-if="sourceVersionLabel(selectedSource)">· {{ sourceVersionLabel(selectedSource) }}</template>
            · {{ itemTypes.length }} коллекций
            · {{ selectedSource.countItems.toLocaleString('ru') }} записей
          </p>
        </div>

        <!-- Collections section -->
        <div class="hb-section-header">
          <span class="hb-section-title">Коллекции</span>
          <span class="hb-section-count">{{ itemTypes.length }}</span>
          <span class="hb-section-meta">· ядро {{ selectedSource.name }}<template v-if="sourceVersionLabel(selectedSource)"> ({{ sourceVersionLabel(selectedSource) }})</template> · только чтение</span>
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
import { sourceVersionLabel } from '@/shared/lib/sourceVersions'
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

<style scoped src="./styles/HandbookLanding.css"></style>
