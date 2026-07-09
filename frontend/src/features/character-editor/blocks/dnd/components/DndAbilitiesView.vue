<template>
  <div class="abv" :class="{ 'abv--panel': panel }">
    <SheetBlockTitle
      v-if="title || manage"
      :title="title"
      :show-edit="manage"
      :edit-fade="editFade"
      @edit="$emit('manage')"
    />

    <div v-if="loading" class="abv-list">
      <div v-for="i in skeletonCount" :key="i" class="abv-skeleton"></div>
    </div>

    <div v-else class="abv-list">
      <div v-if="!entries.length" class="abv-empty">—</div>

      <div
        v-for="entry in entries"
        :key="entry.id"
        class="abv-card"
        title="Подробнее"
        @click="$emit('view', entry)"
        @mouseenter="e => $emit('show-tooltip', e, entry)"
        @mouseleave="$emit('hide-tooltip')"
      >
        <span class="abv-marker" aria-hidden="true" />

        <div v-if="entry.max_use" class="abv-uses">
          <button
            v-for="i in entry.max_use"
            :key="i"
            class="abv-dot"
            :class="{ 'abv-dot-used': i > entry.count }"
            :title="i <= entry.count ? 'Использовать' : 'Восстановить'"
            @click.stop="$emit('toggle-dot', entry, i)"
          />
        </div>

        <span class="abv-name">{{ entry.name }}</span>

        <span v-if="entry.rollback_short_rest" class="abv-badge abv-sr" title="Восстанавливается на коротком отдыхе">КО</span>
        <span v-if="entry.rollback_long_rest" class="abv-badge abv-lr" title="Восстанавливается на длинном отдыхе">ДО</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import SheetBlockTitle from '@/shared/ui/SheetBlockTitle'

defineProps({
  entries: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  skeletonCount: { type: Number, default: 2 },
  title: { type: String, default: '' },
  manage: { type: Boolean, default: false },
  editFade: { type: Boolean, default: false },
  panel: { type: Boolean, default: false },
})
defineEmits(['toggle-dot', 'view', 'show-tooltip', 'hide-tooltip', 'manage'])
</script>

<style scoped>
.abv {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px 10px 10px;
  box-sizing: border-box;
}
.abv--panel { padding-right: 14px; }

.abv-list { display: flex; flex-direction: column; gap: 2px; }

.abv-empty { color: var(--text-muted); font-size: 13px; padding: 4px 6px; }

.abv-skeleton {
  height: 28px;
  border-radius: 8px;
  background: color-mix(in srgb, #fff 6%, var(--block-bg));
  animation: abv-shimmer 1.3s ease-in-out infinite;
}
.abv-skeleton:nth-child(2) { animation-delay: 0.15s; width: 80%; }
.abv-skeleton:nth-child(3) { animation-delay: 0.3s;  width: 65%; }
@keyframes abv-shimmer {
  0%, 100% { opacity: 0.35; }
  50%      { opacity: 0.6; }
}

.abv-card {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 6px;
  border-radius: 8px;
  transition: background-color 0.1s;
  cursor: pointer;
  min-height: 30px;
}
.abv-card:hover { background-color: rgba(255, 255, 255, 0.06); }
.abv-card:hover .abv-name { color: var(--text-1); }

.abv-marker {
  flex-shrink: 0;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  box-sizing: border-box;
  border: 1.5px solid color-mix(in srgb, var(--accent) 50%, transparent);
  display: grid;
  place-items: center;
  transition: border-color 0.12s;
}
.abv-marker::before {
  content: "";
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background-color: color-mix(in srgb, var(--accent) 65%, transparent);
  transition: background-color 0.12s;
}
.abv-card:hover .abv-marker { border-color: var(--accent); }
.abv-card:hover .abv-marker::before { background-color: var(--accent); }

.abv-uses {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}

.abv-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: none;
  background-color: var(--accent);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: opacity 0.12s;
}
.abv-dot-used {
  background-color: transparent;
  border: 1.5px solid var(--border-strong);
}
.abv-dot:hover { opacity: 0.7; }

.abv-name {
  flex: 1;
  color: var(--text-2);
  font-size: 13px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.abv-badge {
  font-size: 9px;
  font-weight: bold;
  letter-spacing: 0.05em;
  padding: 2px 5px;
  border-radius: 4px;
  flex-shrink: 0;
}
.abv-sr { background-color: rgba(90, 175, 114, 0.18); color: #5aaf72; }
.abv-lr { background-color: rgba(79, 143, 204, 0.18); color: #4f8fcc; }
</style>
