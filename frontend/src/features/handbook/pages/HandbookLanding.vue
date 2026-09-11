<template>
  <div class="hb-landing">

    <!-- Collections for the global game context. -->
    <div class="hb-content">
      <div v-if="selectedSource" class="hb-content-inner">
        <div v-if="catalogError" role="alert">{{ catalogError }} <button type="button" @click="fetchTypesForSource(selectedSourceId)">Повторить</button></div>

        <!-- Header -->
        <div class="hb-header">
          <h1 class="hb-title">Справочник</h1>
          <p class="hb-subtitle">
            {{ selectedSource.name }}
            <template v-if="selectedVersion">· {{ selectedVersion.version }}</template>
            · {{ itemTypes.length }} коллекций
            · {{ selectedSource.countItems.toLocaleString('ru') }} записей
          </p>
        </div>

        <!-- Collections section -->
        <div class="hb-section-header">
          <span class="hb-section-title">Коллекции</span>
          <span class="hb-section-count">{{ itemTypes.length }}</span>
          <span class="hb-section-meta">· ядро {{ selectedSource.name }}<template v-if="selectedVersion"> ({{ selectedVersion.version }})</template> · только чтение</span>
        </div>

        <LoadingState v-if="loadingTypes" class="hb-loading" label="Загрузка…" compact />
        <div v-else class="hb-collection-groups">
          <section v-for="group in collectionGroups" :key="group.key" class="hb-collection-group">
            <div class="hb-collection-group-header">
              <span class="hb-collection-group-title">{{ group.name }}</span>
              <span class="hb-collection-group-count">{{ group.types.length }}</span>
              <span class="hb-collection-group-meta">{{ group.description }}</span>
            </div>

            <div class="hb-collections-grid">
              <button
                v-for="type in group.types"
                :key="type.id"
                class="hb-collection-card"
                :style="cardStyle(type)"
                @click="emit('select-type', type, selectedSourceVersionId)"
              >
                <div class="hb-card-top">
                  <span v-if="parentTypeName(type)" class="hb-card-parent">Раздел «{{ parentTypeName(type) }}»</span>
                  <span v-else-if="childTypeNames(type)" class="hb-card-parent">Основной каталог</span>
                  <span class="hb-card-name">{{ type.name }}</span>
                  <p v-if="type.description" class="hb-card-desc">{{ type.description }}</p>
                  <p v-if="childTypeNames(type)" class="hb-card-children">Подразделы: {{ childTypeNames(type) }}</p>
                </div>
                <div class="hb-card-bottom">
                  <span class="hb-card-count">
                    <strong class="hb-card-count-num">{{ type.countItems }}</strong>
                    <span class="hb-card-count-label"> записей</span>
                  </span>
                </div>
                <img
                  v-if="type.iconImageUrl"
                  class="hb-card-icon"
                  :src="type.iconImageUrl"
                  alt=""
                  aria-hidden="true"
                />
              </button>
            </div>
          </section>
        </div>

        <!-- Dictionaries section -->
        <div class="hb-section-header">
          <span class="hb-section-title">Словари</span>
          <span class="hb-section-count">{{ suggestTypes.length }}</span>
          <span class="hb-section-meta">· справочные таблицы — типы, школы, размеры</span>
        </div>

        <LoadingState v-if="loadingDicts" class="hb-loading" label="Загрузка…" compact />
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

      <div v-else-if="sourceError" class="hb-loading" role="alert">{{ sourceError }} <button type="button" @click="fetchSources">Повторить</button></div>
      <LoadingState v-else-if="sourceLoading" class="hb-loading" label="Загружаем источники…" />
      <p v-else class="hb-loading">Нет доступных источников</p>
    </div>

  </div>
</template>

<script setup>
import { LoadingState } from '@sylvieshare/share-ui'
import { visibleHandbookType } from "@/shared/lib/abilityTypes"
import { computed, ref, watch } from 'vue'
import { fetchGet } from '@/shared/api/http'
import { useItemTypesStore } from '@/stores/itemTypes'
import { useGameContextStore } from '@/stores/gameContext'

const itemTypesStore = useItemTypesStore()
const gameContextStore = useGameContextStore()

const emit = defineEmits(['select-type'])

const itemTypes = ref([])
const suggestTypes = ref([])
const sourceLoading = ref(true)
const sourceError = ref('')
const catalogError = ref('')
let catalogRequest = 0
const loadingTypes = ref(false)
const loadingDicts = ref(false)

// Landing groups follow the catalogue hierarchy: for example, races own the
// subrace collection and classes own subclasses. Feature ownership remains in
// item data: race_ids/subrace_ids and class_ids/subclass_ids.
const featureTypeIds = new Set([3, 4, 7, 18])

const selectedSource = computed(() => gameContextStore.selectedSource)
const selectedVersion = computed(() => gameContextStore.selectedVersion)
const selectedSourceId = computed(() => selectedSource.value?.id ?? null)
const selectedSourceVersionId = computed(() => gameContextStore.sourceVersionId)
const collectionGroups = computed(() => {
  const types = itemTypes.value.filter(visibleHandbookType)
  const features = types.filter(type => featureTypeIds.has(Number(type.id)))
  const hierarchyTypes = types.filter(type => !featureTypeIds.has(Number(type.id)))
  const knownIds = new Set(hierarchyTypes.map(type => Number(type.id)))
  const roots = hierarchyTypes.filter(type => type.parentTypeId == null || !knownIds.has(Number(type.parentTypeId)))
  const descendantsOf = (root) => {
    const result = []
    const appendChildren = (parent) => {
      for (const child of hierarchyTypes.filter(type => Number(type.parentTypeId) === Number(parent.id))) {
        result.push(child)
        appendChildren(child)
      }
    }
    appendChildren(root)
    return result
  }
  const families = roots
    .map(root => ({ root, descendants: descendantsOf(root) }))
    .filter(group => group.descendants.length > 0)
  const familyRootIds = new Set(families.map(group => Number(group.root.id)))
  const independent = roots.filter(type => !familyRootIds.has(Number(type.id)))
  const groups = []

  if (independent.length) {
    groups.push({
      key: 'main',
      name: 'Основные разделы',
      description: 'Самостоятельные коллекции',
      types: independent,
    })
  }
  if (features.length) {
    groups.push({
      key: 'features',
      name: 'Способности и черты',
      description: 'Расовые, классовые и сюжетные способности, а также черты',
      types: features,
    })
  }
  for (const { root, descendants } of families) {
    groups.push({
      key: `family-${root.id}`,
      name: root.name,
      description: 'Основной каталог и связанные подразделы',
      types: [root, ...descendants],
    })
  }
  return groups
})

function cardStyle(type) {
  if (!type.color) return {}
  return { '--card-color': type.color }
}
function parentTypeName(type) {
  return itemTypes.value.find(candidate => Number(candidate.id) === Number(type.parentTypeId))?.name || ''
}
function childTypeNames(type) {
  return itemTypes.value
    .filter(candidate => Number(candidate.parentTypeId) === Number(type.id))
    .map(candidate => candidate.name)
    .join(' · ')
}

async function fetchSources() {
  sourceLoading.value = true
  sourceError.value = ''
  try {
    await gameContextStore.ensure()
  } catch {
    sourceError.value = 'Не удалось загрузить источники.'
  } finally {
    sourceLoading.value = false
  }
}

async function fetchTypesForSource(sourceId) {
  const request = ++catalogRequest
  catalogError.value = ''
  loadingTypes.value = true
  loadingDicts.value = true
  try {
    const [types, dictsRes] = await Promise.all([
      itemTypesStore.ensureBySource(sourceId),
      fetchGet(`/suggest/types?sourceId=${sourceId}`),
    ])
    if (request !== catalogRequest) return
    itemTypes.value = types
    suggestTypes.value = dictsRes?.items || []
  } catch {
    if (request === catalogRequest) catalogError.value = 'Не удалось загрузить разделы справочника.'
  } finally {
    if (request === catalogRequest) {
      loadingTypes.value = false
      loadingDicts.value = false
    }
  }
}

watch(selectedSourceId, (id) => {
  if (id != null) fetchTypesForSource(id)
}, { immediate: true })

fetchSources()
</script>

<style scoped src="./styles/HandbookLanding.css"></style>
