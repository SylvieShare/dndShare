<template>
  <div class="hs-wrap" v-click-outside="close">
    <div class="hs-input-row" :class="{ focused: open }">
      <svg class="hs-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5"/>
        <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <input
        ref="inputEl"
        v-model="query"
        class="hs-input"
        type="text"
        placeholder="Поиск по справочнику"
        autocomplete="off"
        spellcheck="false"
        @focus="onFocus"
        @input="onInput"
        @keydown="onKeydown"
      />
      <button v-if="query" class="hs-clear" type="button" tabindex="-1" @click="clear">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <Transition name="hs-dropdown">
      <div v-if="open" class="hs-dropdown">
        <Transition name="hs-status" mode="out-in">
          <div v-if="searchStatus" :key="searchStatus.key" class="hs-status">
            {{ searchStatus.text }}
          </div>
        </Transition>

        <TransitionGroup
          v-if="!searchStatus"
          name="hs-groups"
          tag="div"
          class="hs-groups"
          role="listbox"
          aria-label="Результаты поиска"
        >
          <section
            v-for="group in searchGroups"
            :key="group.key"
            class="hs-group"
            role="group"
            :aria-label="group.label"
          >
            <header class="hs-group-header">
              <span>{{ group.label }}</span>
              <span class="hs-group-count">{{ group.results.length }}</span>
            </header>

            <TransitionGroup name="hs-results" tag="div" class="hs-group-list">
              <div
                v-for="result in group.results"
                :key="result.key"
                class="hs-row"
                :class="{ 'hs-row-active': activeIdx === result.displayIndex }"
                role="option"
                :aria-selected="activeIdx === result.displayIndex"
                @mousedown.prevent="navigate(result)"
                @mouseenter="activeIdx = result.displayIndex"
              >
                <span class="hs-row-icon">
                  <BookOpenCheck v-if="result.kind === 'rule'" class="hs-icon-rule" aria-hidden="true" />
                  <img v-else-if="result.iconImageUrl" class="hs-icon-image" :src="result.iconImageUrl" alt="" />
                  <span v-else-if="result.icon" class="hs-icon-svg" v-html="result.icon" />
                </span>
                <span class="hs-row-name">{{ result.label }}</span>
                <span v-if="result.source" class="hs-row-source">{{ result.source }}</span>
              </div>
            </TransitionGroup>
          </section>
        </TransitionGroup>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpenCheck } from '@lucide/vue'
import { searchPlayerRuleEntries } from '@/features/handbook/rules/lib/playerRules'
import { fetchGet } from '@/shared/api/http'
import { groupHeaderSearchResults } from '@/shared/lib/headerSearch'
import { isDnd5e2014 } from '@/shared/lib/gameSystems'
import { useItemTypesStore } from '@/stores/itemTypes'
import { useGameContextStore } from '@/stores/gameContext'

const NO_ICON_TYPE_IDS = new Set([5, 6])

const router = useRouter()
const gameContextStore = useGameContextStore()
const inputEl = ref(null)
const query = ref('')
const open = ref(false)
const loading = ref(false)
const results = ref([])
const activeIdx = ref(-1)
const searchGroups = computed(() => groupHeaderSearchResults(results.value))
const displayResults = computed(() => searchGroups.value.flatMap(group => group.results))
const searchStatus = computed(() => {
  if (results.value.length > 0) return null
  if (loading.value) return { key: 'loading', text: 'Поиск...' }
  if (query.value.trim().length >= 2) return { key: 'empty', text: 'Ничего не найдено' }
  return { key: 'hint', text: 'Начните ввод...' }
})

let itemTypes = null
let debounceTimer = null
let seq = 0

async function ensureItemTypes() {
  if (itemTypes) return
  itemTypes = await useItemTypesStore().ensureAll()
}

function onFocus() {
  open.value = true
  if (query.value.length >= 2) doSearch()
}

function onInput() {
  activeIdx.value = -1
  clearTimeout(debounceTimer)
  seq += 1
  if (query.value.trim().length < 2) {
    results.value = []
    loading.value = false
    return
  }
  results.value = ruleResultsFor(query.value)
  loading.value = true
  debounceTimer = setTimeout(doSearch, 270)
}

function ruleResultsFor(value) {
  if (!isDnd5e2014(gameContextStore.context)) return []
  return searchPlayerRuleEntries(value).slice(0, 4).map(({ article, section }) => ({
    key: `rule-${article.slug}${section ? `-${section.id}` : ''}`,
    kind: 'rule',
    typeId: 'player-rules',
    typeLabel: 'Правила',
    label: section?.title || article.title,
    source: section ? `${article.shortTitle} · 2014` : 'D&D 5e · 2014',
    url: {
      name: 'PlayerRuleArticle',
      params: { articleSlug: article.slug },
      ...(section ? { hash: `#${section.id}` } : {}),
    },
  }))
}

async function doSearch() {
  const q = query.value.trim()
  if (q.length < 2) return
  loading.value = true
  const currentSeq = ++seq
  let ruleResults = ruleResultsFor(q)
  results.value = ruleResults

  try {
    await Promise.all([ensureItemTypes(), gameContextStore.ensure()])
    ruleResults = ruleResultsFor(q)

    const context = gameContextStore.context
    const scopedTypes = itemTypes.filter(type => Number(type.sourceId) === Number(context?.sourceId))
    const typeIds = scopedTypes.map(t => t.id).join(',')
    const sourceVersionQuery = context?.sourceVersionId ? `&sourceVersionId=${context.sourceVersionId}` : ''
    const sourceQuery = context?.sourceId ? `&sourceId=${context.sourceId}` : ''
    const [itemsRes, suggestRes] = await Promise.all([
      fetchGet(`/items/search-multi?typeIds=${typeIds}&q=${encodeURIComponent(q)}${sourceVersionQuery}`),
      fetchGet(`/suggest/search?q=${encodeURIComponent(q)}&limit=12${sourceQuery}`),
    ])

    if (currentSeq !== seq) return

    const typeById = Object.fromEntries(scopedTypes.map(t => [t.id, t]))
    const suggestTypeById = Object.fromEntries((suggestRes?.types || []).map(t => [t.id, t]))

    const itemResults = (itemsRes?.items || []).slice(0, 8).map(item => {
      const type = typeById[item.typeId]
      return {
        key: 'item-' + item.id,
        kind: 'item',
        typeId: item.typeId,
        typeLabel: type?.name || 'Предметы',
        label: item.name,
        iconImageUrl: item.iconImageUrl || null,
        icon: item.svg || ((type && !NO_ICON_TYPE_IDS.has(item.typeId)) ? type.svg : null),
        source: type?.sourceName || type?.name || null,
        url: { path: '/handbook', query: { type: item.typeId, item: item.id, sourceVersionId: context?.sourceVersionId } },
      }
    })

    const suggestResults = (suggestRes?.items || []).slice(0, 8).map(sug => {
      const type = suggestTypeById[sug.typeId]
      return {
        key: 'sug-' + sug.typeId + '-' + sug.id,
        kind: 'suggest',
        typeId: sug.typeId,
        typeLabel: type?.name || 'Подсказки',
        label: sug.value,
        icon: type?.svg || sug.svg || null,
        source: type?.sourceName || type?.name || null,
        url: { path: '/handbook/dictionary', query: { type: sug.typeId, item: sug.id } },
      }
    })

    results.value = [...ruleResults, ...itemResults, ...suggestResults]
  } catch {
    if (currentSeq === seq) results.value = ruleResults
  } finally {
    if (currentSeq === seq) loading.value = false
  }
}

watch(() => gameContextStore.sourceVersionId, () => {
  if (query.value.trim().length >= 2) doSearch()
})

function navigate(r) {
  router.push(r.url)
  close()
}

function close() {
  open.value = false
  activeIdx.value = -1
}

function clear() {
  clearTimeout(debounceTimer)
  seq += 1
  query.value = ''
  results.value = []
  loading.value = false
  activeIdx.value = -1
  open.value = false
  inputEl.value?.focus()
}

function onKeydown(e) {
  if (!open.value) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIdx.value = Math.min(activeIdx.value + 1, displayResults.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIdx.value = Math.max(activeIdx.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const r = displayResults.value[activeIdx.value]
    if (r) navigate(r)
    else if (query.value.trim()) {
      router.push({ path: '/handbook', query: { q: query.value.trim() } })
      close()
    }
  } else if (e.key === 'Escape') {
    close()
    inputEl.value?.blur()
  }
}

function focus() {
  inputEl.value?.focus()
}

defineExpose({ focus })

onBeforeUnmount(() => {
  clearTimeout(debounceTimer)
  seq += 1
})
</script>

<style scoped>
.hs-wrap {
  position: relative;
  flex-shrink: 0;
}

.hs-input-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 8px;
  height: 32px;
  transition: border-color 0.15s, background 0.15s, width 0.2s;
  width: 180px;
}

.hs-input-row.focused,
.hs-input-row:focus-within {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  width: 260px;
}

.hs-search-icon {
  color: var(--text-2, var(--text-muted));
  flex-shrink: 0;
}

.hs-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  padding: 0;
  min-width: 0;
}

.hs-input::placeholder {
  color: var(--text-2);
}

.hs-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  color: var(--text-muted);
  border-radius: 4px;
  flex-shrink: 0;
  transition: color 0.12s;
}
.hs-clear:hover { color: var(--danger); }

/* ── Dropdown ── */
.hs-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 320px;
  max-height: 360px;
  overflow-y: auto;
  background: var(--popover-bg);
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  box-shadow: var(--shadow-lg);
  z-index: 200;
  box-sizing: border-box;
  padding: 4px;
  transform-origin: top left;
}

.hs-dropdown-enter-active,
.hs-dropdown-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.hs-dropdown-leave-active { pointer-events: none; }

.hs-dropdown-enter-from,
.hs-dropdown-leave-to {
  opacity: 0;
  transform: translateX(-8px) scale(0.985);
}

.hs-status {
  padding: 16px 12px;
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
}

.hs-status-enter-active,
.hs-status-leave-active {
  transition: opacity 0.14s ease, transform 0.16s ease;
}

.hs-status-enter-from { opacity: 0; transform: translateY(4px); }
.hs-status-leave-to { opacity: 0; transform: translateY(-4px); }

.hs-groups,
.hs-group-list {
  position: relative;
}

.hs-group + .hs-group {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
}

.hs-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 24px;
  padding: 2px 10px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.hs-group-count {
  min-width: 16px;
  color: var(--text-2);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.hs-groups-move,
.hs-groups-enter-active,
.hs-groups-leave-active,
.hs-results-move,
.hs-results-enter-active,
.hs-results-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}

.hs-groups-enter-from,
.hs-results-enter-from {
  opacity: 0;
  transform: translateY(7px) scale(0.985);
}

.hs-groups-leave-to,
.hs-results-leave-to {
  opacity: 0;
  transform: translateY(-5px) scale(0.985);
}

.hs-groups-leave-active,
.hs-results-leave-active {
  position: absolute;
  inset-inline: 0;
  pointer-events: none;
}

.hs-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.1s;
  min-width: 0;
}

.hs-row:hover,
.hs-row-active {
  background: var(--surface-raised);
}

.hs-row-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hs-icon-svg {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: var(--text-2, var(--text-muted));
}
.hs-icon-rule {
  width: 18px;
  height: 18px;
  color: var(--accent-soft);
}
.hs-icon-image {
  display: block;
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.hs-icon-svg :deep(svg) {
  width: 20px;
  height: 20px;
  max-width: 20px;
  max-height: 20px;
}

.hs-row-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.hs-row-source {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
  white-space: nowrap;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hs-dropdown::-webkit-scrollbar {
  width: 4px;
}
.hs-dropdown::-webkit-scrollbar-track { background: transparent; }
.hs-dropdown::-webkit-scrollbar-thumb { background: var(--surface-active); border-radius: 4px; }

@media (prefers-reduced-motion: reduce) {
  .hs-dropdown-enter-active,
  .hs-dropdown-leave-active,
  .hs-status-enter-active,
  .hs-status-leave-active,
  .hs-groups-move,
  .hs-groups-enter-active,
  .hs-groups-leave-active,
  .hs-results-move,
  .hs-results-enter-active,
  .hs-results-leave-active {
    transition: none;
  }
}
</style>
