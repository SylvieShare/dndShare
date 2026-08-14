<template>
  <button
    type="button"
    class="ram-item"
    :class="tone !== 'default' ? `ram-item--${tone}` : null"
    :aria-haspopup="submenu ? 'menu' : undefined"
    :aria-expanded="submenu ? submenuOpen : undefined"
  >
    <span class="ram-item__icon" aria-hidden="true">
      <slot name="icon">
        <component :is="resolvedIcon" :size="17" :stroke-width="1.9" />
      </slot>
    </span>
    <span class="ram-item__content"><slot /></span>
    <span v-if="$slots.suffix || submenu" class="ram-item__suffix">
      <slot name="suffix" />
      <ChevronRight
        v-if="submenu"
        class="ram-item__submenu-chevron"
        :class="{ 'ram-item__submenu-chevron--open': submenuOpen }"
        :size="15"
        :stroke-width="2"
      />
    </span>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import {
  ChevronRight,
  Copy,
  Ellipsis,
  Eye,
  FilePenLine,
  HeartPulse,
  Link,
  PackagePlus,
  Pencil,
  Pill,
  Plus,
  RotateCcw,
  Trash2,
  UserRoundX,
} from '@lucide/vue'

const ACTION_ICONS = {
  create: Plus,
  copy: Copy,
  'copy-link': Link,
  delete: Trash2,
  edit: Pencil,
  note: FilePenLine,
  replenish: PackagePlus,
  revive: HeartPulse,
  reset: RotateCcw,
  remove: Trash2,
  kick: UserRoundX,
  use: Pill,
  view: Eye,
}

const props = defineProps({
  action: { type: String, default: '' },
  icon: { type: [Object, Function], default: null },
  submenu: { type: Boolean, default: false },
  submenuOpen: { type: Boolean, default: false },
  tone: {
    type: String,
    default: 'default',
    validator: value => ['default', 'accent', 'warning', 'success', 'info', 'danger'].includes(value),
  },
})

const resolvedIcon = computed(() => props.icon || ACTION_ICONS[props.action] || Ellipsis)
</script>

<style scoped>
.ram-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 36px;
  padding: 7px 8px;
  background: none;
  border: 1px solid transparent;
  border-radius: 7px;
  color: var(--text-1);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
  cursor: pointer;
  text-align: left;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transform-origin: center;
  --ram-item-press-bg: color-mix(in srgb, var(--text-on-accent) 10%, transparent);
  transition:
    color 100ms ease,
    background-color 100ms ease,
    transform 80ms cubic-bezier(0.2, 0.8, 0.3, 1);
}
.ram-item:not(:disabled):hover { background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); }
.ram-item:disabled { cursor: default; opacity: 0.5; }
.ram-item__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  transition: transform 90ms cubic-bezier(0.2, 0.8, 0.3, 1);
}
.ram-item__content { flex: 1 1 auto; min-width: 0; }
.ram-item__suffix { display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto; }
.ram-item__submenu-chevron { color: var(--text-muted); transition: transform 120ms ease; }
.ram-item--accent { color: var(--accent-soft); --ram-item-press-bg: color-mix(in srgb, var(--accent) 22%, transparent); }
.ram-item--accent:not(:disabled):hover { background: color-mix(in srgb, var(--accent) 14%, transparent); }
.ram-item--warning { color: var(--warning); --ram-item-press-bg: color-mix(in srgb, var(--warning) 20%, transparent); }
.ram-item--warning:not(:disabled):hover { background: color-mix(in srgb, var(--warning) 12%, transparent); }
.ram-item--success { color: var(--success); --ram-item-press-bg: color-mix(in srgb, var(--success) 20%, transparent); }
.ram-item--success:not(:disabled):hover { background: color-mix(in srgb, var(--success) 12%, transparent); }
.ram-item--info { color: var(--info); --ram-item-press-bg: color-mix(in srgb, var(--info) 20%, transparent); }
.ram-item--info:not(:disabled):hover { background: color-mix(in srgb, var(--info) 12%, transparent); }
.ram-item--danger { color: var(--danger); --ram-item-press-bg: color-mix(in srgb, var(--danger) 20%, transparent); }
.ram-item--danger:not(:disabled):hover { background: color-mix(in srgb, var(--danger) 12%, transparent); }
.ram-item:active:not(:disabled) { background: var(--ram-item-press-bg); transform: scale(0.975); }
.ram-item:active:not(:disabled) .ram-item__icon { transform: scale(0.84); }

@media (prefers-reduced-motion: reduce) {
  .ram-item, .ram-item__icon { transition: none; }
  .ram-item:active:not(:disabled),
  .ram-item:active:not(:disabled) .ram-item__icon { transform: none; }
}

@media (max-width: 768px) {
  .ram-item__submenu-chevron--open { transform: rotate(90deg); }
}
</style>
