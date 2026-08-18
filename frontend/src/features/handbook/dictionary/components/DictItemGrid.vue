<template>
  <div class="dict-grid-panel">
    <template v-if="!type">
      <div class="empty-hint">Выберите словарь</div>
    </template>
    <template v-else>
      <!-- Item grid -->
      <div v-if="loading" class="empty-hint">Загрузка...</div>
      <div v-else-if="items.length === 0" class="empty-hint">Нет значений</div>
      <div v-else class="items-grid">
        <button
          v-for="item in items"
          :key="item.id"
          class="item-card"
          :class="{ selected: selectedItem && selectedItem.id === item.id }"
          :style="[
            item.color ? { '--card-border': item.color + '55' } : {},
            selectedItem && selectedItem.id === item.id && item.color
              ? { '--card-sel-bg': item.color + '18', '--card-sel-border': item.color + '90' }
              : {}
          ]"
          @click="$emit('select', item)"
        >
          <!-- Icon area -->
          <div
            class="card-icon"
            :style="item.color ? { background: item.color + '22', borderColor: item.color + '55', color: item.color } : {}"
          >
            <SvgIcon v-if="item.svg" class="card-icon-svg" :svg="item.svg" />
            <span v-else class="card-icon-placeholder">{{ (item.value || '?')[0] }}</span>
          </div>

          <!-- Content -->
          <div class="card-body">
            <div class="card-name-row">
              <span class="card-name">{{ item.value }}</span>
              <span v-if="item.code" class="card-code">{{ item.code }}</span>
            </div>
            <div v-if="item.desc" class="card-desc">{{ stripTags(item.desc) }}</div>
          </div>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import SvgIcon from '@/shared/ui/SvgIcon'

defineProps({
  type: { type: Object, default: null },
  items: { type: Array, default: () => [] },
  selectedItem: { type: Object, default: null },
  loading: { type: Boolean, default: false },
})

defineEmits(['select'])

function stripTags(html) {
  return html ? html.replace(/<[^>]*>/g, '') : ''
}
</script>

<style scoped>
.dict-grid-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--border);
}

.empty-hint {
  color: var(--text-2);
  font-size: 14px;
  padding: 60px 0;
  text-align: center;
  margin: auto 0;
}

/* ── Items grid ── */
.items-grid {
  flex: 1;
  overflow-y: auto;
  padding: 12px 12px 20px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  align-content: start;
}

.item-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--card-border, var(--border));
  background: color-mix(in srgb, var(--text-on-accent) 2.5%, transparent);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
}
.item-card:hover { background: color-mix(in srgb, var(--text-on-accent) 4%, transparent); }
.item-card.selected {
  background: var(--card-sel-bg, color-mix(in srgb, var(--accent) 10%, transparent));
  border-color: var(--card-sel-border, color-mix(in srgb, var(--accent-soft) 35%, transparent));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--card-sel-border, color-mix(in srgb, var(--accent-soft) 25%, transparent)) 50%, transparent);
}

.card-icon {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-on-accent) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 9%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.card-icon-svg {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  color: currentColor;
}

.card-icon-placeholder {
  font-size: 18px;
  font-weight: 700;
  color: currentColor;
  text-transform: uppercase;
}

.card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.card-name-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.card-name {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-code {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  white-space: nowrap;
  flex-shrink: 0;
}

.card-desc {
  font-size: 11px;
  color: var(--text-2);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (max-width: 1100px) {
  .items-grid { grid-template-columns: 1fr; }
}
</style>
