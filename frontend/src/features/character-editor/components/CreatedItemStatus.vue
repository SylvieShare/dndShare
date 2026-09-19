<template><span v-if="creation" class="created-item-status" :class="{ expired: creation.expired }"><Clock :size="13" />{{ creation.expired ? 'Магия закончилась' : `Создано магией · ${statusDuration(creation.duration)}` }}</span></template>
<script setup>
import { computed } from 'vue'
import { Clock } from '@lucide/vue'
import { statusDuration } from '@/shared/lib/statusDuration'
const props = defineProps({ entry: Object })
const creation = computed(() => props.entry?.params?.creation)
</script>
<style scoped>
.created-item-status { display: inline-flex; align-items: center; gap: 5px; color: var(--accent-soft); font-size: 11px; line-height: 1.5; }
.created-item-status.expired { color: var(--text-muted); }
</style>
