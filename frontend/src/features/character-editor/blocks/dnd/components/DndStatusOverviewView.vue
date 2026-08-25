<template>
  <div v-if="items.length || editable" class="dsov">
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
        <ItemIcon
          v-if="item.item && (item.item.iconImageUrl || item.item.svg)"
          class="dsov-item-icon"
          :item="item.item"
          :fallback-to-type="false"
          :size="62"
        />
        <BatteryLow v-else-if="item.kind === 'exhaustion'" :size="38" :stroke-width="1.7" aria-hidden="true" />
        <Sparkles v-else-if="item.kind === 'inspiration'" :size="40" :stroke-width="1.7" aria-hidden="true" />
        <span v-else class="dsov-monogram" aria-hidden="true">{{ monogram(item.value) }}</span>

        <span class="dsov-caption">
          <span class="dsov-name">{{ item.value }}</span>
          <span v-if="item.level" class="dsov-level">Уровень {{ item.level }}</span>
        </span>
      </component>
    </div>

    <button v-if="editable" class="dsov-edit" type="button" @click.stop="$emit('edit', 'states')">
      Редактировать состояние
    </button>
  </div>
</template>

<script setup>
import { BatteryLow, Sparkles } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'

defineProps({
  items: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
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
  align-items: center;
  gap: 9px;
  overflow-x: auto;
  scrollbar-width: thin;
}
.dsov-effect {
  position: relative;
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  flex: 0 0 64px;
  overflow: hidden;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--status-color) 38%, var(--border));
  border-radius: 12px;
  background: color-mix(in srgb, var(--status-color) 10%, var(--surface-raised));
  color: var(--status-color);
  cursor: pointer;
  transition: border-color 0.14s, transform 0.14s;
}
.dsov-effect--static { cursor: default; }
.dsov-item-icon { width: 62px; height: 62px; }
.dsov-item-icon :deep(img),
.dsov-item-icon :deep(svg) { width: 100%; height: 100%; object-fit: cover; }
.dsov-monogram { font-size: 24px; font-weight: 800; }
.dsov-caption {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  min-height: 21px;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  padding: 4px 3px 3px;
  background: color-mix(in srgb, var(--scrim) 78%, transparent);
  color: var(--text-on-accent);
  box-sizing: border-box;
  text-align: center;
}
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .dsov-caption {
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
  }
}
.dsov-name {
  overflow: hidden;
  font-size: 8px;
  font-weight: 750;
  line-height: 1.05;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsov-level { font-size: 7px; font-weight: 650; line-height: 1; opacity: 0.82; }
.dsov-edit {
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
  .dsov-effect:not(.dsov-effect--static):hover { border-color: var(--status-color); transform: translateY(-1px); }
  .dsov-edit:hover { color: var(--text-2); }
}
</style>
