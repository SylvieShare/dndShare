<template>
  <DetailSection v-if="uses.length" label="Особое применение оружия" tone="combat">
    <ItemUsePanel v-for="use in uses" :key="use.key" :title="use.title" :subtitle="subtitle(use)">
      <BaseTile v-for="step in use.steps" :key="step.key" class="weapon-use-summary-step">
        <strong>{{ step.title }}</strong>
        <div class="weapon-use-summary-dice"><span v-if="step.kind === 'weapon_damage'">Урон оружия +</span><DamageDice :parts="parts(step)" :size="28" /></div>
        <MechanicTheses :lines="weaponUseRequirements(step, use.range_ft)" />
      </BaseTile>
    </ItemUsePanel>
  </DetailSection>
</template>
<script setup>
import { BaseTile } from '@sylvieshare/share-ui'
import DetailSection from '@/shared/ui/DetailSection.vue'
import MechanicTheses from '@/shared/ui/MechanicTheses.vue'
import ItemUsePanel from '@/features/character-editor/blocks/dnd/components/ItemUsePanel.vue'
import DamageDice from '@/features/character-editor/blocks/dnd/components/DamageDice.vue'
import { weaponDamageActionParts } from '@/shared/lib/weaponDamageOptions'
import { weaponUseRequirements } from '@/shared/lib/weaponUsePresentation'
import { useSuggestStore } from '@/stores/suggest'
const props = defineProps({ uses: { type: Array, default: () => [] }, data: { type: Object, default: () => ({}) } })
const suggest = useSuggestStore()
function parts(step) {
  const type = suggest.items(12).find(row => Number(row.id) === Number(step.damage_type))
  return weaponDamageActionParts(step).map(part => ({ ...part, type: type?.value, typeColor: type?.color }))
}
function subtitle(use) {
  const resource = use.resource_key ? (props.data.use_resources || []).find(row => row.key === use.resource_key)?.title : 'заряды предмета'
  return [use.attack_mode === 'melee' ? 'Рукопашная атака' : `Дистанция до ${use.range_ft} футов`,
    Number(use.resource_cost) > 0 && `Расход при атаке: ${use.resource_cost} (${resource || 'ресурс предмета'}), даже при промахе`,
  ].filter(Boolean).join(' · ')
}
</script>
<style scoped>
.weapon-use-summary-step { padding: 10px; display: grid; gap: 8px; min-width: 0; }
.weapon-use-summary-step strong { color: var(--text-1); font-size: 13px; }
.weapon-use-summary-step :deep(.mechanic-theses) { margin: 0; }
.weapon-use-summary-dice { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; color: var(--text-2); font-size: 12px; }
</style>
