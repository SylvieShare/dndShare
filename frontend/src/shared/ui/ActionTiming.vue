<template>
  <span class="action-timing" :title="timeLabel(time)" :style="{ color: tone }">
    <component :is="actionIcon(kind)" :size="15" aria-hidden="true" /><span>{{ label || timeLabel(time, false) }}</span>
  </span>
</template>
<script setup>
import { computed } from 'vue'
import { actionIcon, actionTone } from './actionTimingIcons'
import { timeLabel } from '@/shared/lib/spellPresentation'
const props = defineProps({ time: Object, label: String })
const kind = computed(() => props.time?.kind || 'special')
const tone = computed(() => actionTone(kind.value))
</script>
<style scoped>
.action-timing { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 800; letter-spacing: .065em; text-transform: uppercase; }
.action-timing > svg { flex-shrink: 0; }
</style>
