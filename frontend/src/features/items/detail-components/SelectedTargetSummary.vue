<template>
  <DetailSection v-if="rule" :label="rule.title || 'Выбранная цель'" tone="combat">
    <template #icon><Crosshair /></template>
    <p v-if="rule.condition">{{ rule.condition }}</p>
    <div class="target-summary">
      <BaseTile v-if="rule.damage"><span>Дополнительный урон по цели</span><DamageDice :parts="damageParts" :size="32" /></BaseTile>
      <BaseTile v-for="text in facts" :key="text">{{ text }}</BaseTile>
    </div>
  </DetailSection>
</template>
<script setup>
import { computed } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import { Crosshair } from '@lucide/vue'
import DetailSection from '@/shared/ui/DetailSection.vue'
import DamageDice from '@/features/character-editor/blocks/dnd/components/DamageDice.vue'
import { useSuggestStore } from '@/stores/suggest'
import { weaponDamageActionParts } from '@/shared/lib/weaponDamageOptions'
const props = defineProps({ rule: Object })
const suggest = useSuggestStore()
const damageParts = computed(() => {
  const type = suggest.items(12).find(row => Number(row.id) === Number(props.rule?.damage?.damage_type))
  return weaponDamageActionParts(props.rule?.damage).map(part => ({ ...part, type: type?.value || 'Тип загружается…', typeColor: type?.color }))
})
const facts = computed(() => [props.rule.attack_advantage && 'Преимущество против выбранной цели', props.rule.ranged_only && 'Бонусы по цели — только для дальних атак', props.rule.other_weapons_disadvantage && 'Пока цель жива — помеха атакам другим оружием', props.rule.ignore_partial_cover && 'Игнорирует укрытие, кроме полного', props.rule.ignore_long_range && 'Без помехи от дальней дистанции', `Срок: ${props.rule.duration_dawns} рассветов`, `После гибели: ожидание ${props.rule.cooldown_dawns} рассветов`].filter(Boolean))
</script>
<style scoped>
.target-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.target-summary > * { padding: 12px; font-size: 12px; display: grid; gap: 6px; }
@media (max-width: 540px) { .target-summary { grid-template-columns: 1fr; } }
</style>
