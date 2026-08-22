<template>
  <div class="abv" :class="{ 'abv--panel': panel, 'abv--expanded': expanded }">
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
        @mouseenter="e => !expanded && $emit('show-tooltip', e, entry)"
        @mouseleave="!expanded && $emit('hide-tooltip')"
      >
        <span class="abv-icon" aria-hidden="true">
          <ItemIcon v-if="expanded" :item="entry.item" :size="64" :fallback-to-type="false" />
          <SvgIcon v-else-if="entry.svg" class="abv-icon-svg" :svg="entry.svg" />
        </span>

        <span class="abv-copy">
          <span class="abv-name">
            {{ entry.name }}<span v-if="entry.scaling_label" class="abv-scaling"> · {{ entry.scaling_label }}</span>
          </span>
          <span v-if="entry.choice_summary" class="abv-choice">{{ entry.choice_summary }}</span>
          <DndRichContent v-if="expanded && entry.desc" class="abv-description" :html="entry.desc" />
          <span
            v-for="effect in entry.passive_effects || []"
            :key="effect.key"
            class="abv-effect"
            :class="`abv-effect--${effect.tone}`"
          >
            <b>{{ effect.title }}</b><template v-if="effect.description"> — {{ effect.description }}</template>
          </span>
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
import DndRichContent from '@/shared/ui/DndRichContent.vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'

defineProps({
  entries: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  skeletonCount: { type: Number, default: 2 },
  title: { type: String, default: '' },
  manage: { type: Boolean, default: false },
  editFade: { type: Boolean, default: false },
  panel: { type: Boolean, default: false },
  expanded: { type: Boolean, default: false },
})
defineEmits(['view', 'show-tooltip', 'hide-tooltip', 'manage'])
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
.abv-scaling { color: var(--accent); font-weight: 750; }
.abv-choice { color: var(--text-muted); font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.abv-effect { margin-top: 2px; color: var(--text-2); font-size: 10px; line-height: 1.35; }
.abv-effect b { color: var(--info); font-weight: 650; }
.abv-effect--warning b { color: var(--warning); }
.abv-effect--danger b { color: var(--danger); }
.abv-effect--success b { color: var(--success); }

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

.abv--expanded { gap: 8px; padding: 0; }
.abv--expanded .abv-list { gap: 0; }
.abv--expanded .abv-card { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; align-items: start; gap: 13px; min-height: 88px; padding: 13px 2px; border: 0; border-radius: 0; background: transparent; }
.abv--expanded .abv-card + .abv-card { border-top: 1px solid var(--border); }
.abv--expanded .abv-card:hover { background: color-mix(in srgb, var(--accent) 4%, transparent); }
.abv--expanded .abv-icon { width: 64px; height: 64px; color: var(--text-2); }
.abv--expanded .abv-name { font-size: 15px; font-weight: 750; white-space: normal; overflow: visible; }
.abv--expanded .abv-choice { margin-top: 2px; font-size: 10px; white-space: normal; overflow: visible; }
.abv-description { margin-top: 5px; color: var(--text-2); font-size: 11px; line-height: 1.5; }
.abv-description :deep(p) { margin: 0; }
.abv-description :deep(p + p) { margin-top: 6px; }
.abv--expanded .abv-effect { margin-top: 5px; font-size: 10px; }
@media (max-width: 520px) {
  .abv--expanded .abv-card { grid-template-columns: 56px minmax(0, 1fr) auto; gap: 10px; padding: 10px; }
  .abv--expanded .abv-icon { width: 56px; height: 56px; }
  .abv--expanded .abv-icon :deep(.item-icon) { width: 56px !important; height: 56px !important; }
}
</style>
