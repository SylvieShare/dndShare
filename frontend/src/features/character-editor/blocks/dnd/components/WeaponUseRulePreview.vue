<template>
  <p class="weapon-use-summary">{{ rule.attack_mode === 'melee' ? 'Рукопашная атака' : 'Дистанция до ' + rule.range_ft + ' футов' }}<span v-if="rule.resource_cost > 0"> · расход при атаке: {{ rule.resource_cost }}, даже при промахе</span></p>
  <div v-for="step in rule.steps || []" :key="step.key" class="weapon-use-preview-step">
    <strong>{{ step.title }}</strong>
    <div class="weapon-use-preview-dice"><span v-if="step.kind === 'weapon_damage'">Урон оружия +</span><DamageDice :parts="parts(step)" :size="28" /></div>
    <MechanicTheses :lines="weaponUseRequirements(step, rule.range_ft)" />
  </div>
</template>
<script setup>
import DamageDice from './DamageDice.vue'
import MechanicTheses from '@/shared/ui/MechanicTheses.vue'
import { weaponDamageActionParts } from '@/shared/lib/weaponDamageOptions'
import { weaponUseRequirements } from '@/shared/lib/weaponUsePresentation'
import { useSuggestStore } from '@/stores/suggest'
defineProps({ rule: Object })
const suggest = useSuggestStore()
function parts(step) {
  const type = suggest.items(12).find(row => Number(row.id) === Number(step.damage_type))
  return weaponDamageActionParts(step).map(part => ({ ...part, type: type?.value, typeColor: type?.color }))
}
</script>
<style scoped>
.weapon-use-summary { margin: 0; color: var(--text-2); font-size: 12px; }
.weapon-use-preview-step { display: grid; gap: 8px; min-width: 0; }
.weapon-use-preview-step > strong { color: var(--text-1); font-size: 13px; }
.weapon-use-preview-dice { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
</style>
