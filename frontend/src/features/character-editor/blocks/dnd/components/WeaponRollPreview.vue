<template>
  <div class="weapon-roll-preview" aria-label="Превью броска">
    <div class="weapon-roll-preview__heading"><span>{{ heading || (scope === 'attack' ? 'Формула атаки' : 'Формула урона') }}</span><b v-if="scope === 'attack'">{{ signed(attackBonus) }}</b></div>
    <WeaponDamageBreakdown v-if="scope === 'attack'" :rows="attackRows" label="Состав атаки" :roll-color="attackColor" damage-color="var(--accent-soft)" dice-labels />
    <WeaponDamageBreakdown v-else :rows="damageRows" label="Состав урона" :damage-type="damageType" :damage-color="damageColor" />
  </div>
</template>
<script setup>
import WeaponDamageBreakdown from './WeaponDamageBreakdown.vue'
import { formatBonus as signed } from '@/shared/lib/dnd'
defineProps({ scope: String, heading: String, attackBonus: Number, attackRows: Array, attackColor: String, damageRows: Array, damageType: String, damageColor: String })
</script>
<style scoped>
.weapon-roll-preview {display:grid;gap:var(--spacing-small);min-width:0}
.weapon-roll-preview__heading {display:flex;align-items:baseline;justify-content:space-between;gap:var(--spacing-medium);font-size:var(--type-context-size);color:var(--text-muted)}
.weapon-roll-preview__heading b {color:var(--accent-soft);font-size:var(--type-group-size)}
</style>
