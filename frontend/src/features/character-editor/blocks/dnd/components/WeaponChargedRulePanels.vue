<template>
  <ItemMechanicPanel v-for="rule in rules" :key="rule.key" kind="rule" :title="rule.title || rule.label">
    <template #summary><WeaponLinkedCharges :resources="rule.resources" :interactive="interactive" @toggle="(resource, pip) => $emit('toggle', resource, pip)" /></template>
    <DndRichContent v-if="rule.description" :html="rule.description" :item="item" />
    <DamageDice v-if="rule.dice" :parts="damageParts(rule)" :size="28" />
    <MechanicTheses :lines="[rule.condition, ...(rule.requirements || []), rule.dice && 'Выберите это свойство в меню урона оружия.'].filter(Boolean)" />
  </ItemMechanicPanel>
</template>
<script setup>
import ItemMechanicPanel from '@/features/items/components/ItemMechanicPanel.vue'
import WeaponLinkedCharges from './WeaponLinkedCharges.vue'
import DndRichContent from '@/shared/ui/DndRichContent.vue'
import MechanicTheses from '@/shared/ui/MechanicTheses.vue'
import DamageDice from './DamageDice.vue'
import { weaponDamageActionParts } from '@/shared/lib/weaponDamageOptions'
import { useSuggestStore } from '@/stores/suggest'
defineProps({ rules: { type: Array, default: () => [] }, item: Object, interactive: Boolean })
defineEmits(['toggle'])
const suggest = useSuggestStore()
function damageParts(rule) {
  const type = suggest.items(12).find(row => Number(row.id) === Number(rule.damage_type))
  return weaponDamageActionParts(rule).map(part => ({ ...part, type: type?.value, typeColor: type?.color }))
}
</script>
