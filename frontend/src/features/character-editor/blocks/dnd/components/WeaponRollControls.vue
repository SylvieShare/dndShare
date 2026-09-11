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
    <small v-if="blocked" role="alert">{{ blocked.resourceError }}</small>
    <RowActionItem :disabled="!!blocked" :action="scope === 'attack' ? 'attack' : 'damage'" @click="!blocked && $emit('roll')">{{ scope === 'attack' ? 'Бросить на атаку' : 'Бросить на урон' }}</RowActionItem>
  </div>
</template>
<script setup>
import { FormField, ToggleSwitch } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import WeaponRollOption from './WeaponRollOption.vue'
import { computed } from 'vue'
const props = defineProps({ scope: { type: String, default: 'damage' }, options: { type: Array, default: () => [] }, critical: Boolean, twoHanded: Boolean, versatile: Boolean, thrown: Boolean })
const blocked = computed(() => props.scope === 'damage' && props.options.find(option => option.checked && option.resourceError))
defineEmits(['update:critical', 'update:twoHanded', 'select', 'roll'])
</script>
<style scoped>
.weapon-roll-controls { display: flex; flex-direction: column; gap: 10px; padding: 8px; min-width: 240px; }
</style>
