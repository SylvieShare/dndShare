<template>
  <BaseTile class="creature-tile" :class="{ 'creature-tile--compact': compact, 'creature-tile--controls': controlsVisible, 'creature-tile--current': current, 'creature-tile--statuses': hasStatuses }"
    :style="{ '--participant-color': color || 'var(--border)', '--participant-frame-width': color ? '2px' : '1px' }"
    :title="compact ? name : undefined" interactive>
    <div v-if="$slots.controls" class="p-combat-controls" :aria-hidden="!controlsVisible" :inert="!controlsVisible" @click.stop @pointerdown.stop><slot name="controls" /></div>
    <div class="creature-tile-body">
      <div class="p-content">
        <div class="p-summary">
          <slot name="avatar">
            <SessionCreatureAvatar :name="name" :url="avatarUrl" :icon="icon" :background="avatarColor" />
          </slot>
          <div class="p-info" :class="{ 'p-info--stats': !!$slots.stats }" :inert="compact" :aria-hidden="compact">
            <div class="p-name-row"><slot name="name-prefix" /><span class="p-name">{{ name }}</span><slot name="name-suffix" /></div>
            <div class="creature-tile-health"><slot name="health" /></div>
            <div v-if="$slots.stats" class="creature-tile-stats"><slot name="stats" /></div>
          </div>
        </div>
        <div v-if="hasStatuses" class="p-statuses-area" :inert="compact" :aria-hidden="compact">
          <span class="p-statuses-label" aria-hidden="true">состояния:</span><div class="creature-tile-statuses"><slot name="statuses" /></div>
        </div>
      </div>
      <div v-if="$slots.result" class="creature-tile-result"><slot name="result" /></div>
    </div>
  </BaseTile>
</template>
<script setup>
import { BaseTile } from '@sylvieshare/share-ui'
import SessionCreatureAvatar from './SessionCreatureAvatar.vue'
defineProps({
  name: { type: String, default: '' }, avatarUrl: String, icon: Boolean, avatarColor: String,
  color: String, compact: Boolean, current: Boolean, controlsVisible: Boolean, hasStatuses: Boolean,
})
</script>
<style scoped>
.creature-tile { width: 100%; min-width: 0; box-sizing: border-box; display: flex; align-items: center; gap: var(--participant-card-gap, 9px); min-height: 72px; padding: 4px 14px 4px 4px; overflow: hidden; user-select: none; transition: min-height .42s cubic-bezier(.22,1,.36,1), gap .42s, padding .42s, background .18s, box-shadow .18s; }
.creature-tile.base-tile, .creature-tile.base-tile--interactive:hover { box-shadow: inset 0 0 0 var(--participant-frame-width) var(--participant-color); }
.creature-tile--statuses { min-height: 112px; }
.creature-tile-body { display: flex; align-items: center; flex: 1; min-width: 0; flex-wrap: wrap; column-gap: 12px; row-gap: 8px; }
.p-content { flex: 1 1 200px; min-width: 0; max-width: 100%; }
.p-summary { display: flex; align-items: center; gap: var(--participant-card-gap, 9px); height: 64px; min-width: 0; transition: height .42s, gap .42s; }
.p-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; transition: opacity .2s, transform .42s; }
.p-info--stats { align-self: stretch; display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 0; margin-bottom: -4px; }
.p-name-row { display: flex; align-items: center; min-width: 0; gap: 6px; }
.p-name { flex: 1; min-width: 0; font-size: 13px; line-height: 16px; font-weight: 600; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.creature-tile-health { min-width: 0; }
.creature-tile-health :deep(.hp-row) { margin-top: 0; height: 6px; min-width: 0; }
.creature-tile-stats { min-width: 0; grid-row: 3; }
.p-statuses-area { display: flex; align-items: center; gap: var(--participant-card-gap, 9px); height: 36px; margin-top: 4px; overflow: hidden; transition: height .42s, margin-top .42s, opacity .2s; }
.p-statuses-label { flex: 0 0 64px; color: var(--text-muted); font-size: 10px; font-weight: 400; line-height: 14px; text-align: center; }
.creature-tile-statuses { flex: 1; min-width: 0; }
.creature-tile-result { width: 248px; flex: 0 1 248px; max-width: 100%; min-width: 0; margin-left: auto; }
.p-combat-controls { width: var(--participant-selection-width, 36px); flex: 0 0 var(--participant-selection-width, 36px); box-sizing: border-box; padding: 0 2px 0 10px; display: flex; justify-content: center; margin-left: calc(-1 * (var(--participant-selection-width, 36px) + var(--participant-card-gap, 9px))); clip-path: inset(0 0 0 100%); pointer-events: none; transition: margin-left .42s, clip-path .42s; }
.creature-tile--controls .p-combat-controls { margin-left: 0; clip-path: inset(-12px); pointer-events: auto; }
.creature-tile.creature-tile--current, .creature-tile.creature-tile--current.base-tile--interactive:hover { background: color-mix(in srgb, var(--accent) 11%, var(--surface)); border-color: color-mix(in srgb, var(--accent) 42%, var(--border)); box-shadow: inset 0 0 0 var(--participant-frame-width) var(--participant-color), 0 0 0 2px color-mix(in srgb, var(--accent) 10%, transparent); }
.creature-tile--compact { min-height: 48px; height: 48px; gap: 0; padding: 6px; justify-content: center; }
.creature-tile--compact .p-combat-controls { margin-left: calc(-1 * var(--participant-selection-width, 36px)); }
.creature-tile--compact .p-summary { height: 36px; gap: 0; }
.creature-tile--compact :deep(.p-avatar) { flex-basis: 36px; width: 36px; height: 36px; }
.creature-tile--compact .p-info { flex: 0 0 0; overflow: hidden; opacity: 0; transform: translateX(-7px); }
.creature-tile--compact .p-statuses-area { height: 0; margin-top: 0; opacity: 0; }
@media (prefers-reduced-motion: reduce) { .creature-tile, .p-combat-controls, .p-info, .p-summary, .p-statuses-area { transition: none; } }
</style>
