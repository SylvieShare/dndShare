<template>
  <ActionMenuItem
    :icon="resolvedIcon"
    :submenu="submenu"
    :submenu-open="submenuOpen"
    :tone="tone"
  >
    <template v-if="$slots.icon" #icon><slot name="icon" /></template>
    <slot />
    <template v-if="$slots.suffix" #suffix><slot name="suffix" /></template>
  </ActionMenuItem>
</template>

<script setup>
import { computed } from 'vue'
import { ActionMenuItem } from '@sylvieshare/share-ui'
import {
  Copy,
  Crosshair,
  Dices,
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
  Sparkles,
  Swords,
  Trash2,
  UserRoundPlus,
  UserRoundX,
} from '@lucide/vue'

const ACTION_ICONS = {
  attack: Crosshair,
  create: Plus,
  copy: Copy,
  'copy-link': Link,
  delete: Trash2,
  edit: Pencil,
  damage: Swords,
  'feature-damage': Dices,
  'feature-critical': Sparkles,
  note: FilePenLine,
  replenish: PackagePlus,
  revive: HeartPulse,
  reset: RotateCcw,
  critical: Sparkles,
  remove: Trash2,
  kick: UserRoundX,
  join: UserRoundPlus,
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
