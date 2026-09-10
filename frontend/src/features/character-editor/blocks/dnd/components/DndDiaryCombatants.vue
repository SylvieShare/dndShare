<template>
  <div class="diary-combatants">
    <div v-for="creature in combatants" :key="creature.id" class="diary-combatant">
      <ItemIcon v-if="creature.source === 'handbook'" :item="itemById(creature.itemId)" :size="32" placeholder />
      <span v-else class="diary-combatant-avatar" aria-hidden="true"><PawPrint :size="17" /></span>
      <div class="diary-combatant-copy">
        <div class="diary-combatant-heading"><strong>{{ creatureName(creature) }}</strong><span v-if="creature.count > 1" class="diary-combatant-count">×{{ creature.count }}</span></div>
        <span v-if="creature.ac != null || creature.hp != null" class="diary-combatant-stats"><span v-if="creature.ac != null"><Shield :size="13" /> {{ creature.ac }}</span><span v-if="creature.hp != null"><Heart :size="13" /> {{ creature.hp }}</span></span>
        <p v-if="creature.desc">{{ creature.desc }}</p>
      </div>
    </div>
    <p v-if="!combatants.length" class="diary-empty-copy">Участники пока не добавлены.</p>
  </div>
</template>
<script setup>
import { Heart, Shield, PawPrint } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
const props = defineProps({ combatants: { type: Array, default: () => [] }, itemsById: { type: Map, default: () => new Map() } })
const itemById = id => props.itemsById.get(String(id)) ?? null
const creatureName = creature => creature.source === 'handbook'
  ? creature.itemName || itemById(creature.itemId)?.name || `Существо #${creature.itemId || '—'}`
  : creature.name || 'Без названия'
</script>
<style scoped>
.diary-combatants { display: flex; flex-wrap: wrap; gap: 10px 20px; min-width: 0; }
.diary-combatant { display: flex; flex: 1 1 210px; min-width: 0; align-items: flex-start; gap: 10px; padding: 6px 0; }
.diary-combatant:has(.journal-inline-form) { flex-basis: 100%; }
.diary-combatants > .diary-inline-add { flex-basis: 100%; }
.diary-combatant :deep(.journal-inline-form) { width: 100%; padding: 0; }
.diary-combatant-avatar { display: grid; place-items: center; flex: 0 0 32px; height: 32px; border-radius: 8px; color: var(--danger); background: color-mix(in srgb, var(--danger) 8%, transparent); }
.diary-combatant-heading { display: flex; align-items: baseline; gap: 8px; min-height: 32px; padding-top: 6px; box-sizing: border-box; }
.diary-combatant-count { flex: none; color: var(--text-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.diary-combatant-copy { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 4px; }
.diary-combatant-copy strong { color: var(--text-1); font-size: 13px; overflow-wrap: anywhere; }
.diary-combatant-stats, .diary-combatant-stats > span { display: flex; align-items: center; gap: 6px; color: var(--text-muted); font-size: 12px; }
.diary-combatant-stats { gap: 14px; }
.diary-combatant-copy p { margin: 0; color: var(--text-2); font-size: 13px; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
