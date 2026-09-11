<template>
  <div class="initial-charge-fields">
    <FormField :label="label" title="Укажите, сколько зарядов осталось у найденного предмета. Это запас данного экземпляра." vertical>
      <FormTextInput type="number" :value="modelValue" :min="0" :max="100" :step="1" :placeholder="rule.mode === 'roll' ? 'Введите число или бросьте кости' : 'Количество зарядов'" :aria-label="label" @update:value="update" />
    </FormField>
    <ActionButton v-if="rule.mode === 'roll'" variant="secondary" :disabled="!!ruleError" @click="roll"><Dices :size="16" />Бросить {{ rule.formula }}</ActionButton>
    <DiceRollResult v-if="rolled" :result="rolled" :size="24" />
    <p v-if="ruleError" role="alert">{{ ruleError }}</p>
  </div>
</template>
<script setup>
import { computed, ref } from 'vue'
import { ActionButton, FormField, FormTextInput } from '@sylvieshare/share-ui'
import { Dices } from '@lucide/vue'
import DiceRollResult from '@/shared/ui/DiceRollResult.vue'
import { useDiceStore } from '@/stores/dice'
import { initialChargeRuleError } from '@/shared/lib/itemInitialCharges'
const props = defineProps({ rule: { type: Object, required: true }, label: { type: String, default: 'Начальный запас зарядов' }, modelValue: [Number, String], title: String })
const emit = defineEmits(['update:modelValue'])
const dice = useDiceStore(), rolled = ref(null)
const ruleError = computed(() => initialChargeRuleError(props.rule))
function update(value) { rolled.value = null; emit('update:modelValue', value) }
function roll() {
  if (ruleError.value) return
  rolled.value = dice.roll(`Начальные заряды: ${props.title || 'Предмет'}`, props.rule.formula, { log: false, popup: false })
  emit('update:modelValue', rolled.value.total)
}
</script>
<style scoped>
.initial-charge-fields { display: grid; gap: 10px; }
.initial-charge-fields > button { justify-self: start; }
.initial-charge-fields p { margin: 0; color: var(--danger); }
</style>
