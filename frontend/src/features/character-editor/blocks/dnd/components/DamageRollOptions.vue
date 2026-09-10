<template>
  <div class="damage-roll-options" role="group" aria-label="Параметры урона">
    <FormField label="Критическое попадание" title="Удваивает кости урона, но не постоянные прибавки.">
      <ToggleSwitch v-model="critical" aria-label="Критическое попадание" />
    </FormField>
    <FormField v-if="versatile && !thrown" label="Двумя руками" title="Использует кость урона для хвата двумя руками.">
      <ToggleSwitch v-model="twoHanded" aria-label="Двумя руками" />
    </FormField>
    <div v-for="option in menuOptions" :key="option.key" :class="{ 'damage-dependent-option': option.nested }">
      <FormField :label="option.label" :title="option.hint">
        <span v-if="option.damageParts.length" class="damage-option-formula" :aria-label="`Добавит ${option.formula}`" role="img">
          <span aria-hidden="true">+</span>
          <DamageDice :parts="option.damageParts" :size="26" :default-color="option.disabled ? 'var(--text-muted)' : 'var(--accent-soft)'" aria-hidden="true" />
        </span>
        <ToggleSwitch :model-value="option.checked" :disabled="option.disabled" :aria-label="option.label" @update:model-value="value => select(option.key, value)" />
      </FormField>
      <small v-if="option.condition" class="damage-option-condition">{{ option.condition }}</small>
    </div>
    <RowActionItem v-if="canAttack" action="attack" @click="$emit('attack', options)">Бросок на атаку</RowActionItem>
    <RowActionItem action="damage" @click="$emit('roll', options)">Бросить урон</RowActionItem>
  </div>
</template>
<script setup>
import { computed, ref } from 'vue'
import { FormField, ToggleSwitch } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import DamageDice from './DamageDice.vue'
import { damageAttackMode, selectedDamageActions, toggleDamageAction, weaponDamageMenuOptions } from '@/shared/lib/weaponDamageOptions'
const props = defineProps({ actions: { type: Array, default: () => [] }, versatile: Boolean, canAttack: Boolean })
defineEmits(['roll', 'attack'])
const critical = ref(false), twoHanded = ref(false), selected = ref([])
const thrown = computed(() => damageAttackMode(props.actions, selected.value) === 'thrown')
const menuOptions = computed(() => weaponDamageMenuOptions(props.actions, selected.value, critical.value))
const options = computed(() => ({ critical: critical.value, twoHanded: props.versatile && twoHanded.value && !thrown.value,
  actionKeys: selectedDamageActions(props.actions, selected.value).map(action => action.key) }))
function select(key, value) { selected.value = toggleDamageAction(props.actions, selected.value, key, value) }
</script>
<style scoped>
.damage-roll-options { display: flex; flex-direction: column; gap: 10px; padding: 8px; min-width: 240px; }
.damage-dependent-option { margin-left: 8px; padding-left: 10px; border-left: 2px solid var(--border); }
.damage-option-condition { display: block; max-width: 300px; color: var(--text-muted); font-size: 11px; line-height: 1.4; margin-top: 4px; }
.damage-option-formula { display: inline-flex; align-items: center; gap: 3px; flex: none; white-space: nowrap; color: var(--text-muted); font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
