<template>
  <section v-if="rows.length" class="race-spells" :aria-label="label">
    <div class="sheet-section-title">{{ label }}</div>
    <HandbookReferenceRows :rows="rows" :z-index="zIndex" />
  </section>
</template>
<script setup>
import { computed } from 'vue'
import HandbookReferenceRows from './HandbookReferenceRows.vue'
import { raceSpellReferences } from '../lib/raceSpellReferences'
const props = defineProps({ label: { type: String, default: 'Заклинания происхождения' }, zIndex: { type: Number, default: 5100 }, abilities: { type: Array, default: () => [] } })
const rows = computed(() => raceSpellReferences(props.abilities))
</script>
<style scoped>
.race-spells { display: grid; gap: 8px; min-width: 0; }
</style>
