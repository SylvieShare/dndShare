<template>
  <button
    type="button"
    class="ram-item"
    :class="tone !== 'default' ? `ram-item--${tone}` : null"
  >
    <span class="ram-item__icon" aria-hidden="true">
      <slot name="icon">
        <component :is="resolvedIcon" :size="17" :stroke-width="1.9" />
      </slot>
    </span>
    <span class="ram-item__content"><slot /></span>
    <span v-if="$slots.suffix" class="ram-item__suffix"><slot name="suffix" /></span>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import {
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
  tone: {
    type: String,
    default: 'default',
    validator: value => ['default', 'warning', 'success', 'info', 'danger'].includes(value),
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
}
.ram-item:hover { background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); }
.ram-item:disabled { cursor: default; opacity: 0.5; }
.ram-item__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
}
.ram-item__content { flex: 1 1 auto; min-width: 0; }
.ram-item__suffix { display: inline-flex; align-items: center; flex: 0 0 auto; }
.ram-item--warning { color: var(--warning); }
.ram-item--warning:hover { background: color-mix(in srgb, var(--warning) 12%, transparent); }
.ram-item--success { color: var(--success); }
.ram-item--success:hover { background: color-mix(in srgb, var(--success) 12%, transparent); }
.ram-item--info { color: var(--info); }
.ram-item--info:hover { background: color-mix(in srgb, var(--info) 12%, transparent); }
.ram-item--danger { color: var(--danger); }
.ram-item--danger:hover { background: color-mix(in srgb, var(--danger) 12%, transparent); }
</style>
