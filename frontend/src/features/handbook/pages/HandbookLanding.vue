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
        <div v-for="src in sources" :key="src.id" class="hb-source-group">
          <button
            class="hb-source-item"
            :class="{ active: src.id === selectedSourceId }"
            @click="selectSource(src)"
          >
            <span class="hb-source-name">{{ src.name }}</span>
            <span class="hb-source-version">{{ activeVersionLabel(src) }}</span>
          </button>
          <div v-if="src.id === selectedSourceId" class="hb-version-list" aria-label="Редакция правил">
            <button
              v-for="version in src.versions"
              :key="version.id"
              type="button"
              :class="{ active: version.id === selectedSourceVersionId }"
              @click="selectVersion(version.id)"
            >
              {{ version.version }}
            </button>
          </div>
        </div>
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

        <div v-if="loadingTypes" class="hb-loading">Загрузка…</div>
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
import { useGameContextStore } from '@/stores/gameContext'

const itemTypesStore = useItemTypesStore()
const gameContextStore = useGameContextStore()

const props = defineProps({ sourceVersionId: { type: [Number, String], default: null } })
const emit = defineEmits(['select-type', 'update:source-version-id'])

const sources = ref([])
const selectedSourceId = ref(null)
const selectedSourceVersionId = ref(null)
const itemTypes = ref([])
const suggestTypes = ref([])
const loadingTypes = ref(false)
const loadingDicts = ref(false)

const selectedSource = computed(() => sources.value.find(s => s.id === selectedSourceId.value) || null)
const selectedVersion = computed(() => selectedSource.value?.versions?.find(
  version => Number(version.id) === Number(selectedSourceVersionId.value),
) || null)
const collectionGroups = computed(() => {
  const types = itemTypes.value
  const knownIds = new Set(types.map(type => Number(type.id)))
  const roots = types.filter(type => type.parentTypeId == null || !knownIds.has(Number(type.parentTypeId)))
  const descendantsOf = (root) => {
    const result = []
    const appendChildren = (parent) => {
      for (const child of types.filter(type => Number(type.parentTypeId) === Number(parent.id))) {
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

function activeVersionLabel(source) {
  if (source.id === selectedSourceId.value && selectedVersion.value) return selectedVersion.value.version
  return source.versions?.[0]?.version || '—'
}

function selectSource(source) {
  selectedSourceId.value = source.id
  const preferredID = props.sourceVersionId || gameContextStore.sourceVersionId
  const preferred = source.versions?.find(version => Number(version.id) === Number(preferredID))
  selectVersion((preferred || source.versions?.[0])?.id || null)
}

function selectVersion(versionID) {
  selectedSourceVersionId.value = versionID
  emit('update:source-version-id', versionID)
}
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
  await gameContextStore.ensure()
  sources.value = gameContextStore.sources
  const preferredID = props.sourceVersionId || gameContextStore.sourceVersionId
  const source = sources.value.find(item => item.versions?.some(version => Number(version.id) === Number(preferredID))) || sources.value[0]
  if (source) selectSource(source)
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
