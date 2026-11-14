<template>
  <span class="action-timing" :class="{ 'action-timing--inherit': size === 'inherit' }" :title="timeLabel(time)" :style="{ color: tone }">
    <component :is="actionIcon(kind)" :size="size === 'inherit' ? 18 : 15" aria-hidden="true" /><span>{{ label || timeLabel(time, false) }}</span>
  </span>
</template>
<script setup>
import { computed } from 'vue'
import { actionIcon, actionTone } from './actionTimingIcons'
import { timeLabel } from '@/shared/lib/spellPresentation'
const props = defineProps({ time: Object, label: String, size: { type: String, default: 'compact', validator: value => ['compact','inherit'].includes(value) } })
const kind = computed(() => props.time?.kind || 'special')
const tone = computed(() => actionTone(kind.value))
</script>
<style scoped>
.action-timing { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 800; letter-spacing: .065em; text-transform: uppercase; }
.action-timing > svg { flex-shrink: 0; }
.action-timing--inherit {max-width:100%;min-width:0;font-size:inherit;line-height:inherit;font-weight:inherit;letter-spacing:normal}
.action-timing--inherit>span {min-width:0;overflow-wrap:anywhere}
</style>
