<template>
  <DetailSection v-if="rows.length" label="Источники применения">
    <HandbookReferenceRows :rows="rows" :z-index="zIndex" />
  </DetailSection>
</template>
<script setup>
import { computed } from 'vue'
import { DetailSection } from '@sylvieshare/share-ui'
import HandbookReferenceRows from './HandbookReferenceRows.vue'
const props = defineProps({ sources: { type: Array, default: () => [] }, zIndex: { type: Number, default: 5100 } })
const rows = computed(() => props.sources.map((row, index) => ({
  id: row.item?.id ?? row.item, key: `${row.item?.id ?? row.item}:${row.key || index}`,
  condition: [row.target === 'other' ? 'На цель' : 'На владельца', row.condition].filter(Boolean).join(' · '),
})).filter(row => row.id))
</script>
