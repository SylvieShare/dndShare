<template>
  <aside class="dict-sidebar">
    <div class="sidebar-head">
      <span class="sidebar-title">Словари</span>
    </div>
    <div class="sidebar-search-wrap">
      <svg class="sidebar-search-icon" viewBox="0 0 16 16" fill="none">
        <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.5"/>
        <path d="M10 10L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <input
        v-model="searchQ"
        class="sidebar-search"
        placeholder="Найти словарь..."
      />
    </div>

    <div class="sidebar-list">
      <button
        v-for="type in filteredTypes"
        :key="type.id"
        class="sidebar-row"
        :class="{ active: selectedTypeId === type.id }"
        @click="$emit('select', type)"
      >
        <div class="sidebar-row-main">
          <span class="sidebar-row-name">{{ type.name }}</span>
          <span v-if="type.count != null" class="sidebar-row-count">{{ type.count }}</span>
        </div>
        <div v-if="type.description" class="sidebar-row-desc">{{ type.description }}</div>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  types: { type: Array, default: () => [] },
  selectedTypeId: { type: Number, default: null },
})

defineEmits(['select'])

const searchQ = ref('')

const filteredTypes = computed(() => {
  const q = searchQ.value.trim().toLowerCase()
  if (!q) return props.types
  return props.types.filter(t =>
    t.name.toLowerCase().includes(q) ||
    (t.description || '').toLowerCase().includes(q)
  )
})
</script>

<style scoped>
.dict-sidebar {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
}

.sidebar-head {
  padding: 6px 16px 10px;
  flex-shrink: 0;
}

.sidebar-title {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  color: var(--text-1);
}

.sidebar-search-wrap {
  position: relative;
  padding: 0 12px 8px;
  flex-shrink: 0;
}

.sidebar-search-icon {
  position: absolute;
  left: 21px;
  top: 50%;
  transform: translateY(-55%);
  width: 14px;
  height: 14px;
  color: var(--text-muted);
  pointer-events: none;
}

.sidebar-search {
  width: 100%;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  padding: 7px 10px 7px 30px;
  outline: none;
  box-sizing: border-box;
}
.sidebar-search:focus { border-color: var(--accent); }

.sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0 12px;
}

.sidebar-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  padding: 9px 16px;
  border: none;
  border-left: 2px solid transparent;
  background: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background 0.12s, border-color 0.12s;
}
.sidebar-row:hover { background: rgba(255,255,255,0.04); }
.sidebar-row.active {
  background: rgba(106,100,216,0.1);
  border-left-color: var(--accent);
}

.sidebar-row-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sidebar-row-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
.sidebar-row.active .sidebar-row-name { color: #fff; }

.sidebar-row-count {
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.sidebar-row-desc {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 900px) {
  .dict-sidebar { width: 220px; }
}

@media (max-width: 680px) {
  .dict-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border);
    max-height: 220px;
  }
  .sidebar-list { overflow-y: auto; }
}
</style>
