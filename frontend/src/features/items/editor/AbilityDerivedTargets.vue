<template>
  <AbilityRuleFields v-if="targetField && !data.target_from_choice" :fields="[targetField]" :data="data" @update:data="value => Object.assign(data, value)" />
</template>
<script setup>
import { computed, watch } from 'vue'
import { useSuggestStore } from '@/stores/suggest'
import AbilityRuleFields from './AbilityRuleFields.vue'
const props = defineProps({ data: Object })
const store = useSuggestStore()
const targets = { skill_proficiency: [15, 'Навыки', 'skill_ids'], skill_bonus: [15, 'Навыки', 'skill_ids'], tool_proficiency: [5, 'Инструменты', 'target_ids'], weapon_proficiency: [4, 'Оружие', 'target_ids'], armor_proficiency: [3, 'Доспехи', 'target_ids'], language_proficiency: [6, 'Языки', 'target_ids'] }
const targetField = computed(() => {
  const target = targets[props.data.kind]
  return target && { key: target[2], type: 'suggest_array', suggest_id: target[0], name: target[1], hint: 'Выберите цели правила по названиям.' }
})
watch(() => targetField.value?.suggest_id, id => { if (id) store.ensure(id).catch(() => {}) }, { immediate: true })
</script>
