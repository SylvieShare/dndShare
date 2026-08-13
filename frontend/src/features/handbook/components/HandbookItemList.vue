<template>
  <div class="item-list-panel" :class="{ 'has-item': !!selectedItem }">
    <template v-if="!type">
      <div class="empty-hint">Выберите коллекцию</div>
    </template>
    <template v-else>
      <div class="list-body" @scroll="onScroll">
        <div v-if="loading" class="empty-hint">Загрузка...</div>
        <div v-else-if="items.length === 0" class="empty-hint">Нет объектов</div>
        <div v-else class="items-list">

          <!-- ── Grouped mode ── -->
          <template v-if="groupBy">
            <template v-for="group in groupedItems" :key="group.label">
              <div
                class="item-group-header"
                :class="{ collapsed: collapsedGroups.has(group.label) }"
                @click="toggleGroup(group.label)"
              >
                <svg class="item-group-chevron" viewBox="0 0 16 16" fill="none" width="13" height="13">
                  <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="item-group-name">{{ group.label }}</span>
                <span class="item-group-count">{{ group.items.length }}</span>
                <span class="item-group-line" aria-hidden="true"></span>
              </div>
              <template v-if="!collapsedGroups.has(group.label)">
                <div
                  v-for="item in group.items"
                  :key="item.id"
                  class="list-row list-row-rich"
                  :class="{ selected: selectedItem && selectedItem.id === item.id }"
                  @click="$emit('select', item)"
                >
                  <EnemyListItem v-if="type.id === 6" :item="item" :type="type" />
                  <WeaponListItem v-else-if="type.id === 1" :item="item" :type="type" />
                  <SpellListItem v-else-if="type.id === 5" :item="item" :type="type" />
                  <ItemListItem v-else-if="type.id === 2" :item="item" :type="type" />
                  <PotionListItem v-else-if="type.id === 10" :item="item" :type="type" />
                  <FeatListItem v-else-if="type.id === 7" :item="item" :type="type" />
                  <template v-else>
                    <ItemIcon v-if="item.svg" :item="item" :fallback-to-type="false" :size="22" />
                    <span class="item-name">{{ item.name }}</span>
                    <span v-if="item.userId != null" class="item-custom-mark" title="Ваш объект">✦</span>
                  </template>
                </div>
              </template>
            </template>
          </template>

          <!-- ── Flat mode ── -->
          <template v-else>
            <div
              v-for="item in items"
              :key="item.id"
              class="list-row"
              :class="{ selected: selectedItem && selectedItem.id === item.id, 'list-row-rich': hasRichRenderer }"
              @click="$emit('select', item)"
            >
              <EnemyListItem v-if="type.id === 6" :item="item" :type="type" />
              <WeaponListItem v-else-if="type.id === 1" :item="item" :type="type" />
              <SpellListItem v-else-if="type.id === 5" :item="item" :type="type" />
              <ItemListItem v-else-if="type.id === 2" :item="item" :type="type" />
              <PotionListItem v-else-if="type.id === 10" :item="item" :type="type" />
              <FeatListItem v-else-if="type.id === 7" :item="item" :type="type" />
              <template v-else>
                <ItemIcon v-if="item.svg" :item="item" :fallback-to-type="false" :size="22" />
                <span class="item-name">{{ item.name }}</span>
                <span v-if="item.userId != null" class="item-custom-mark" title="Ваш объект">✦</span>
              </template>
            </div>
          </template>

          <div v-if="loadingMore" class="list-tail list-loading">
            <span class="list-spinner" aria-hidden="true"></span>
            <span>Подгружаем ещё</span>
          </div>
          <button v-else-if="hasMore" class="list-tail list-more" @click="$emit('load-more')">
            Загрузить ещё
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { findFieldByPath, getByPath, getSuggestId } from '@/features/handbook/objects/lib/schemaFields'
import { useSuggestStore } from '@/stores/suggest'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import EnemyListItem from '@/features/items/list-components/EnemyListItem'
import FeatListItem from '@/features/items/list-components/FeatListItem'
import ItemListItem from '@/features/items/list-components/ItemListItem'
import PotionListItem from '@/features/items/list-components/PotionListItem'
import SpellListItem from '@/features/items/list-components/SpellListItem'
import WeaponListItem from '@/features/items/list-components/WeaponListItem'
import { dieLabel } from '@/shared/lib/systemDice'

const props = defineProps({
  type: { type: Object, default: null },
  selectedItem: { type: Object, default: null },
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  loadingMore: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: false },
  groupBy: { type: String, default: null },
})

const emit = defineEmits(['select', 'load-more'])

const suggestStore = useSuggestStore()

const collapsedGroups = ref(new Set())
function toggleGroup(label) {
  const s = new Set(collapsedGroups.value)
  s.has(label) ? s.delete(label) : s.add(label)
  collapsedGroups.value = s
}

const hasRichRenderer = computed(() => [1, 2, 5, 6, 7, 10].includes(props.type?.id))

function crToNum(cr) {
  if (!cr || cr === '—') return Infinity
  if (String(cr).includes('/')) {
    const [n, d] = String(cr).split('/')
    return parseInt(n) / parseInt(d)
  }
  return parseFloat(cr) || 0
}

const groupedItems = computed(() => {
  if (!props.groupBy) return []
  const field = findFieldByPath(props.type?.fields || [], props.groupBy)
  const isSuggest = field && (field.type === 'suggest' || field.type === 'suggest_array')
  const isDice = field?.type === 'dice'
  const suggestId = isSuggest ? getSuggestId(field) : null
  const suggests = suggestId ? (suggestStore.items(suggestId) || []) : []

  const map = new Map()
  for (const item of props.items) {
    let rawVal = getByPath(item.data, props.groupBy)
    if (Array.isArray(rawVal)) rawVal = rawVal[0]
    let label
    if (isDice && rawVal != null) {
      label = dieLabel(rawVal) || String(rawVal)
    } else if (isSuggest && rawVal != null) {
      label = suggests.find(s => s.id === rawVal)?.value ?? String(rawVal)
    } else {
      label = rawVal != null && rawVal !== '' ? String(rawVal) : '—'
    }
    if (!map.has(label)) map.set(label, [])
    map.get(label).push(item)
  }

  const entries = [...map.entries()].map(([label, items]) => ({ label, items }))
  if (props.groupBy.endsWith('cr')) {
    entries.sort((a, b) => crToNum(a.label) - crToNum(b.label))
  } else {
    entries.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  }
  return entries
})

function onScroll(e) {
  if (!props.hasMore || props.loading || props.loadingMore) return
  const el = e.currentTarget
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) emit('load-more')
}
</script>

<style scoped>
.item-list-panel {
  width: 500px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.empty-hint {
  color: var(--text-2);
  font-size: 14px;
  padding: 40px 0;
  text-align: center;
}

/* ── List body ── */
.list-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0 14px;
}

.items-list { display: flex; flex-direction: column; }

/* ── Group header ── */
.item-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 14px 6px;
  cursor: pointer;
  user-select: none;
}
.item-group-header:hover .item-group-name { color: var(--text-1); }

.item-group-chevron {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: transform 0.18s;
}
.item-group-header.collapsed .item-group-chevron { transform: rotate(-90deg); }

.item-group-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-2);
  flex-shrink: 0;
  transition: color 0.12s;
}

.item-group-count {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--border);
  color: var(--text-muted);
  flex-shrink: 0;
}

.item-group-line {
  flex: 1;
  height: 1px;
  background: var(--border);
  margin-left: 2px;
}

/* ── Rows ── */
.list-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  cursor: pointer;
  transition: background 0.12s;
}
.list-row:hover { background: color-mix(in srgb, var(--text-on-accent) 5%, transparent); }
.list-row.selected { background: color-mix(in srgb, var(--accent) 15%, transparent); }

.list-row-rich {
  margin: 2px 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--text-on-accent) 2%, transparent);
}
.list-row-rich:hover { background: color-mix(in srgb, var(--text-on-accent) 5%, transparent); border-color: color-mix(in srgb, var(--text-on-accent) 12%, transparent); }
.list-row-rich.selected { background: color-mix(in srgb, var(--accent) 15%, transparent); border-color: color-mix(in srgb, var(--accent) 35%, transparent); }

.item-name {
  font-size: 13px;
  color: var(--text-1);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-custom-mark { font-size: 8px; color: var(--accent); flex-shrink: 0; }

/* ── Load more ── */
.list-tail {
  width: 100%;
  padding: 12px 8px;
  color: var(--text-2);
  font-size: 12px;
  text-align: center;
}
.list-more {
  border: none; background: transparent; font-family: inherit; cursor: pointer;
}
.list-more:hover { color: var(--text-1); }
.list-loading {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  border-top: 1px solid color-mix(in srgb, var(--accent-soft) 18%, transparent);
  background: linear-gradient(180deg, color-mix(in srgb, var(--popover-bg) 74%, transparent), var(--popover-bg) 42%), color-mix(in srgb, var(--accent) 8%, transparent);
  color: var(--accent-soft);
}
.list-spinner {
  width: 14px; height: 14px;
  border: 2px solid color-mix(in srgb, var(--accent-soft) 25%, transparent);
  border-top-color: var(--accent-soft);
  border-radius: 50%;
  animation: spin .75s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Responsive ── */
@media (max-width: 1100px) {
  .item-list-panel { width: 380px; }
}

@media (max-width: 760px) {
  .item-list-panel {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border);
    max-height: 46vh;
    min-height: 240px;
    overflow: hidden;
  }
}

@media (max-width: 520px) {
  .item-list-panel {
    max-height: none;
    min-height: 0;
    overflow: visible;
    border-bottom: none;
  }
  .list-body { overflow: visible; }
}
</style>
