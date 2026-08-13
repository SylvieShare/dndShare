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
        placeholder="Поиск..."
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

    <div v-if="open" class="hs-dropdown">
      <div v-if="loading && results.length === 0" class="hs-status">Поиск...</div>
      <div v-else-if="!loading && query.length >= 2 && results.length === 0" class="hs-status">Ничего не найдено</div>
      <div v-else-if="query.length < 2 && results.length === 0" class="hs-status">Начните ввод...</div>

      <div
        v-for="(r, i) in results"
        :key="r.key"
        class="hs-row"
        :class="{ 'hs-row-active': activeIdx === i }"
        @mousedown.prevent="navigate(r)"
        @mouseenter="activeIdx = i"
      >
        <span class="hs-row-icon">
          <img v-if="r.iconImageUrl" class="hs-icon-image" :src="r.iconImageUrl" alt="" />
          <span v-else-if="r.icon" class="hs-icon-svg" v-html="r.icon" />
        </span>
        <span class="hs-row-name">{{ r.label }}</span>
        <span v-if="r.source" class="hs-row-source">{{ r.source }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchGet } from '@/shared/api/http'
import { useItemTypesStore } from '@/stores/itemTypes'

const NO_ICON_TYPE_IDS = new Set([5, 6])

const router = useRouter()
const inputEl = ref(null)
const query = ref('')
const open = ref(false)
const loading = ref(false)
const results = ref([])
const activeIdx = ref(-1)

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
  if (query.value.length < 2) {
    results.value = []
    loading.value = false
    return
  }
  loading.value = true
  debounceTimer = setTimeout(doSearch, 270)
}

async function doSearch() {
  const q = query.value.trim()
  if (q.length < 2) return
  loading.value = true
  const currentSeq = ++seq

  try {
    await ensureItemTypes()

    const typeIds = itemTypes.map(t => t.id).join(',')
    const [itemsRes, suggestRes] = await Promise.all([
      fetchGet(`/items/search-multi?typeIds=${typeIds}&q=${encodeURIComponent(q)}`),
      fetchGet(`/suggest/search?q=${encodeURIComponent(q)}&limit=12`),
    ])

    if (currentSeq !== seq) return

    const typeById = Object.fromEntries(itemTypes.map(t => [t.id, t]))
    const suggestTypeById = Object.fromEntries((suggestRes?.types || []).map(t => [t.id, t]))

    const itemResults = (itemsRes?.items || []).slice(0, 8).map(item => {
      const type = typeById[item.typeId]
      return {
        key: 'item-' + item.id,
        label: item.name,
        iconImageUrl: item.iconImageUrl || null,
        icon: item.svg || ((type && !NO_ICON_TYPE_IDS.has(item.typeId)) ? type.svg : null),
        source: type?.sourceName || type?.name || null,
        url: { path: '/handbook', query: { type: item.typeId, item: item.id } },
      }
    })

    const suggestResults = (suggestRes?.items || []).slice(0, 8).map(sug => {
      const type = suggestTypeById[sug.typeId]
      return {
        key: 'sug-' + sug.typeId + '-' + sug.id,
        label: sug.value,
        icon: type?.svg || sug.svg || null,
        source: type?.sourceName || type?.name || null,
        url: { path: '/handbook/dictionary', query: { type: sug.typeId, item: sug.id } },
      }
    })

    results.value = [...itemResults, ...suggestResults]
  } catch {
    if (currentSeq === seq) results.value = []
  } finally {
    if (currentSeq === seq) loading.value = false
  }
}

function navigate(r) {
  router.push(r.url)
  close()
}

function close() {
  open.value = false
  activeIdx.value = -1
}

function clear() {
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
    activeIdx.value = Math.min(activeIdx.value + 1, results.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIdx.value = Math.max(activeIdx.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const r = results.value[activeIdx.value]
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
  padding: 4px;
}

.hs-status {
  padding: 16px 12px;
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
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
</style>
