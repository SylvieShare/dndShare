<template>
  <ul v-if="rows.length" class="mechanic-theses" :style="{ '--thesis-tone': color }">
    <li v-for="(row, index) in rows" :key="index"><DndRichContent v-if="row.html" :html="row.html" @click.stop /><span v-else>{{ row.text }}</span></li>
  </ul>
</template>
<script setup>
import { computed } from 'vue'
import DndRichContent from './DndRichContent.vue'
import { mechanicTheses } from '@/shared/lib/mechanicTheses'
const props = defineProps({ html: { type: String, default: '' }, lines: { type: Array, default: () => [] }, color: { type: String, default: 'var(--accent)' } })
const rows = computed(() => mechanicTheses(props.html, props.lines))
</script>
<style scoped>
.mechanic-theses { display: grid; gap: 6px; margin: 8px 0 0; padding: 0; list-style: none; clear: both; }
.mechanic-theses > li { display: grid; grid-template-columns: 5px minmax(0, 1fr); gap: 8px; align-items: start; color: var(--text-2); font-size: 13px; line-height: 1.5; }
.mechanic-theses > li::before { width: 5px; height: 5px; margin-top: .55em; border-radius: 50%; background: var(--thesis-tone); content: ''; }
.mechanic-theses :deep(p) { margin: 0; }
</style>
