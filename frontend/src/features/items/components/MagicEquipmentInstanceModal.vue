<template>
  <AppModalFrame :title="item.name" subtitle="Выберите основу экземпляра" :z-index="zIndex" @close="$emit('close')">
    <p>Основа определяет обычные характеристики предмета. Магические свойства добавляются к ним.</p>
    <DetailSection v-for="kind in kinds" :key="kind" :label="kind === 'weapon' ? 'Оружейная основа' : 'Доспех или щит'">
      <MagicEquipmentBases :item="item" :kind="kind" selectable :model-value="chosen[baseParamKey(kind)]" :z-index="zIndex"
        @update:model-value="chosen[baseParamKey(kind)] = $event" @loaded="rows => loaded(kind, rows)" />
    </DetailSection>
    <template #footer><ActionButton variant="primary" :disabled="!complete" @click="confirm">{{ confirmLabel }}</ActionButton></template>
  </AppModalFrame>
</template>
<script setup>
import { computed } from 'vue'
import { ActionButton, AppModalFrame } from '@sylvieshare/share-ui'
import DetailSection from '@/shared/ui/DetailSection.vue'
import MagicEquipmentBases from './MagicEquipmentBases.vue'
import { useMagicBaseSelection } from '@/features/items/lib/useMagicBaseSelection'
import { baseParamKey } from '@/features/items/lib/magicEquipmentBases'
const props = defineProps({ item: Object, params: { type: Object, default: () => ({}) }, zIndex: { type: Number, default: 4700 }, confirmLabel: { type: String, default: 'Добавить предмет' } })
const emit = defineEmits(['close', 'confirm'])
const { kinds, chosen, loaded, complete, result } = useMagicBaseSelection(computed(() => props.item), props.params)
function confirm() { const params = result(); if (params) emit('confirm', params) }
</script>
