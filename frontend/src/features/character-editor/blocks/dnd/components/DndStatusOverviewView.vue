<template>
  <div v-if="items.length || editable" class="dsov">
    <button v-if="showEditAction" class="dsov-edit" type="button" @click.stop="$emit('edit', 'states')">
      <Pencil :size="13" :stroke-width="1.8" aria-hidden="true" />
      <span>Состояние</span>
    </button>

    <div v-if="items.length" class="dsov-row">
      <component
        :is="editable ? 'button' : 'div'"
        v-for="item in items"
        :key="item.id"
        class="dsov-effect"
        :class="{ 'dsov-effect--static': !editable }"
        :type="editable ? 'button' : undefined"
        :style="{ '--status-color': item.color || 'var(--text-muted)' }"
        @click.stop="$emit('edit', item.kind || 'states')"
        @mouseenter="$emit('show-tooltip', $event, item)"
        @mouseleave="$emit('hide-tooltip')"
      >
        <span class="dsov-icon">
          <ItemIcon
            v-if="item.item && (item.item.iconImageUrl || item.item.svg)"
            class="dsov-item-icon"
            :item="item.item"
            :fallback-to-type="false"
            :size="64"
          />
          <BatteryLow v-else-if="item.kind === 'exhaustion'" :size="38" :stroke-width="1.7" aria-hidden="true" />
          <Sparkles v-else-if="item.kind === 'inspiration'" :size="40" :stroke-width="1.7" aria-hidden="true" />
          <span v-else class="dsov-monogram" aria-hidden="true">{{ monogram(item.value) }}</span>
        </span>

        <span v-if="item.level" class="dsov-caption">
          <span class="dsov-level">Уровень {{ item.level }}</span>
        </span>
      </component>
    </div>

  </div>
</template>

<script setup>
import { BatteryLow, Pencil, Sparkles } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'

defineProps({
  items: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
  showEditAction: { type: Boolean, default: false },
})
defineEmits(['edit', 'show-tooltip', 'hide-tooltip'])

function monogram(value) {
  return String(value || '?').trim().slice(0, 1).toUpperCase() || '?'
}
</script>

<style scoped>
.dsov { display: flex; min-width: 0; align-items: center; gap: 13px; }
.dsov-row {
  display: flex;
  min-width: 0;
  flex: 0 1 auto;
  align-items: flex-start;
  gap: 9px;
  overflow-x: auto;
  scrollbar-width: thin;
}
.dsov-effect {
  display: flex;
  width: 64px;
  flex-direction: column;
  align-items: stretch;
  flex: 0 0 64px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--status-color);
  cursor: pointer;
  transition: transform 0.14s;
}
.dsov-effect--static { cursor: default; }
.dsov-icon {
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  overflow: hidden;
}
.dsov-item-icon { width: 64px; height: 64px; }
.dsov-item-icon :deep(img),
.dsov-item-icon :deep(svg) { width: 100%; height: 100%; object-fit: cover; }
.dsov-monogram { font-size: 24px; font-weight: 800; }
.dsov-caption {
  display: flex;
  min-height: 21px;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  padding: 4px 3px 3px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--scrim) 78%, transparent);
  color: var(--text-on-accent);
  box-sizing: border-box;
  text-align: center;
}
.dsov-level { font-size: 7px; font-weight: 650; line-height: 1; opacity: 0.82; }
.dsov-edit {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-muted);
  font: inherit;
  font-size: 11px;
  font-weight: 650;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, currentColor 45%, transparent);
  text-underline-offset: 3px;
}

@media (hover: hover) {
  .dsov-effect:not(.dsov-effect--static):hover { transform: translateY(-1px); }
  .dsov-edit:hover { color: var(--text-2); }
}
</style>
