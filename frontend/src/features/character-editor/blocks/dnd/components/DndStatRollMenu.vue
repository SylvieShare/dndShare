<template>
  <BasePopover
    :open="true"
    :anchor="anchor"
    :z-index="4100"
    transition-preset="action-menu"
    role="menu"
    :aria-label="title"
    @update:open="!$event && emit('close')"
  >
    <D20RollControls :mode="mode" :cancelled="cancelled" @roll="emit('roll', $event)" />
  </BasePopover>
</template>
<script setup>
import { BasePopover } from '@sylvieshare/share-ui'
import D20RollControls from './D20RollControls.vue'
defineProps({
  anchor: { type: Object, required: true },
  title: { type: String, required: true },
  mode: { type: String, default: 'normal' },
  cancelled: Boolean,
})
const emit = defineEmits(['close', 'roll'])
</script>
