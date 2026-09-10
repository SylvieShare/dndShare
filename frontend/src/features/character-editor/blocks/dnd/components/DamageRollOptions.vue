<template>
  <div class="damage-roll-options" role="group" aria-label="Параметры урона">
    <FormField label="Критическое попадание" title="Удваивает кости урона, но не постоянные прибавки.">
      <ToggleSwitch v-model="critical" aria-label="Критическое попадание" />
    </FormField>
    <FormField v-if="versatile" label="Двумя руками" title="Использует кость урона для хвата двумя руками.">
      <ToggleSwitch v-model="twoHanded" aria-label="Двумя руками" />
    </FormField>
    <FormField v-for="action in actions" :key="action.key" :label="`${action.label || action.source_label} · ${action.dice_count}${action.dice.replace('d', 'к')}`" :title="action.once_per_turn ? 'Добавляйте только при выполнении условий способности, не чаще одного раза за ход. Ход не отслеживается автоматически.' : 'Добавить урон этой способности к текущему броску.'">
      <ToggleSwitch :model-value="selected.includes(action.key)" :aria-label="action.label || action.source_label" @update:model-value="value => select(action.key, value)" />
    </FormField>
    <RowActionItem action="damage" @click="$emit('roll', { critical, twoHanded: versatile && twoHanded, actionKeys: selected })">Бросить урон</RowActionItem>
  </div>
</template>
<script setup>
import { ref } from 'vue'
import { FormField, ToggleSwitch } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
defineProps({ actions: { type: Array, default: () => [] }, versatile: Boolean })
defineEmits(['roll'])
const critical = ref(false), twoHanded = ref(false), selected = ref([])
function select(key, value) { selected.value = value ? [...new Set([...selected.value, key])] : selected.value.filter(entry => entry !== key) }
</script>
<style scoped>
.damage-roll-options { display: flex; flex-direction: column; gap: 10px; padding: 8px; min-width: 240px; }
</style>
