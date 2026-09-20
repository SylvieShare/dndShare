<template>
  <section v-if="rows.length" class="race-spells" :aria-label="label">
    <div class="sheet-section-title">{{ label }}</div>
    <HandbookReferenceRows :rows="rows" :z-index="zIndex">
      <template #leading="{ row }">
        <span class="race-spell-level"><strong>С {{ row.level }}-го</strong> уровня</span>
      </template>
    </HandbookReferenceRows>
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
.race-spells { display: grid; gap: 8px; min-width: 0; --handbook-reference-leading-width: 76px; }
.race-spell-level { display: grid; gap: 2px; padding-inline-start: 10px; border-inline-start: 2px solid var(--accent); color: var(--text-muted); font-size: 12px; line-height: 1.4; }
.race-spell-level strong { color: var(--text-1); font-weight: 600; }
</style>
