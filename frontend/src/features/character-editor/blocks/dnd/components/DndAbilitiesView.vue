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
        :key="entry.key || entry.id"
        class="abv-card"
        title="Подробнее"
        @click="$emit('view', entry)"
        @mouseenter="e => $emit('show-tooltip', e, entry)"
        @mouseleave="$emit('hide-tooltip')"
      >
        <span class="abv-icon" aria-hidden="true">
          <SvgIcon v-if="entry.svg" class="abv-icon-svg" :svg="entry.svg" />
        </span>

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

        <span class="abv-copy">
          <span class="abv-name">{{ entry.name }}</span>
          <span v-if="entry.choice_summary" class="abv-choice">{{ entry.choice_summary }}</span>
        </span>

        <span v-if="entry.rollback_short_rest" class="abv-badge abv-sr" title="Восстанавливается на коротком отдыхе">КО</span>
        <span v-if="entry.rollback_long_rest" class="abv-badge abv-lr" title="Восстанавливается на длинном отдыхе">ДО</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import SheetBlockTitle from '@/shared/ui/SheetBlockTitle'
import SvgIcon from '@/shared/ui/SvgIcon.vue'

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
  background: color-mix(in srgb, var(--text-on-accent) 6%, var(--surface));
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
.abv-card:hover { background-color: color-mix(in srgb, var(--text-on-accent) 6%, transparent); }
.abv-card:hover .abv-name { color: var(--text-1); }

.abv-icon {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}
.abv-icon-svg { width: 20px; height: 20px; }
.abv-card:hover .abv-icon { color: var(--text-2); }

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

.abv-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.abv-name {
  color: var(--text-1);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.abv-choice { color: var(--text-muted); font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.abv-badge {
  font-size: 9px;
  font-weight: bold;
  letter-spacing: 0.05em;
  padding: 2px 5px;
  border-radius: 4px;
  flex-shrink: 0;
}
.abv-sr { background-color: color-mix(in srgb, var(--success) 18%, transparent); color: var(--success); }
.abv-lr { background-color: color-mix(in srgb, var(--info) 18%, transparent); color: var(--info); }
</style>
