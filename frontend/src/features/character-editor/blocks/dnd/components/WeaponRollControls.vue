<template>
  <div class="weapon-roll-controls" role="group" :aria-label="scope === 'attack' ? 'Атака' : 'Урон'">
    <template v-if="scope === 'damage'">
      <FormField label="Критическое попадание" title="Удваивает кости урона, но не постоянные прибавки.">
        <ToggleSwitch :model-value="critical" aria-label="Критическое попадание" @update:model-value="$emit('update:critical', $event)" />
      </FormField>
      <FormField v-if="versatile && !thrown" label="Двумя руками" title="Использует кость урона для хвата двумя руками.">
        <ToggleSwitch :model-value="twoHanded" aria-label="Двумя руками" @update:model-value="$emit('update:twoHanded', $event)" />
      </FormField>
    </template>
    <WeaponRollOption v-for="option in options" :key="option.key" :option="option" @select="(key, value) => $emit('select', key, value)" />
    <RowActionItem :action="scope === 'attack' ? 'attack' : 'damage'" @click="$emit('roll')">{{ scope === 'attack' ? 'Бросить на атаку' : 'Бросить на урон' }}</RowActionItem>
  </div>
</template>
<script setup>
import { FormField, ToggleSwitch } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import WeaponRollOption from './WeaponRollOption.vue'
defineProps({ scope: { type: String, default: 'damage' }, options: { type: Array, default: () => [] }, critical: Boolean, twoHanded: Boolean, versatile: Boolean, thrown: Boolean })
defineEmits(['update:critical', 'update:twoHanded', 'select', 'roll'])
</script>
<style scoped>
.weapon-roll-controls { display: flex; flex-direction: column; gap: 10px; padding: 8px; min-width: 240px; }
</style>
