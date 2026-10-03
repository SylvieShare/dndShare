<template>
  <ItemMechanicPanel kind="resource" :title="label || resource.title">
    <template #summary><ItemResourcePips :resource="resource" :interactive="interactive" hide-recovery @toggle="$emit('toggle', $event)" /></template>
    <p class="resource-available">Доступно {{ resource.value }} из {{ resource.total }}</p>
    <MechanicTheses :lines="recovery" />
  </ItemMechanicPanel>
</template>
<script setup>
import { computed } from 'vue'
import ItemMechanicPanel from '@/features/items/components/ItemMechanicPanel.vue'
import MechanicTheses from '@/shared/ui/MechanicTheses.vue'
import ItemResourcePips from './ItemResourcePips.vue'
const props = defineProps({ resource: { type: Object, required: true }, label: String, interactive: Boolean })
defineEmits(['toggle'])
const recovery = computed(() => [
  props.resource.short_rest && 'Все заряды восстанавливаются на коротком отдыхе.',
  props.resource.short_rest_recovery && `Короткий отдых: восстановите ${props.resource.short_rest_recovery} зарядов.`,
  props.resource.long_rest && 'Все заряды восстанавливаются на длинном отдыхе.',
  props.resource.dawn_recovery && (props.resource.dawn_recovery.mode === 'full' ? 'Все заряды восстанавливаются на рассвете.' : `Рассвет: восстановите ${props.resource.dawn_recovery.formula} зарядов.`),
].filter(Boolean))
</script>
<style scoped>
.resource-available { margin: 0; color: var(--text-2); font-size: 12px; }
</style>
