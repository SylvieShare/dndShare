<template>
  <div class="damage-roll-options" role="group" :aria-label="canAttack ? 'Параметры атаки и урона' : 'Параметры урона'">
    <section v-if="canAttack" class="weapon-roll-section" aria-label="Атака">
      <SectionLabel title="Атака" />
      <WeaponRollOption v-for="option in attackOptions" :key="option.key" :option="option" @select="select" />
      <RowActionItem action="attack" @click="$emit('attack', options)">Бросок на атаку</RowActionItem>
    </section>
    <RowActionSeparator v-if="canAttack" />
    <section class="weapon-roll-section" aria-label="Урон">
      <SectionLabel v-if="canAttack" title="Урон" />
      <FormField label="Критическое попадание" title="Удваивает кости урона, но не постоянные прибавки.">
        <ToggleSwitch v-model="critical" aria-label="Критическое попадание" />
      </FormField>
      <FormField v-if="versatile && !thrown" label="Двумя руками" title="Использует кость урона для хвата двумя руками.">
        <ToggleSwitch v-model="twoHanded" aria-label="Двумя руками" />
      </FormField>
      <WeaponRollOption v-for="option in menuOptions" :key="option.key" :option="option" @select="select" />
      <RowActionItem action="damage" @click="$emit('roll', options)">Бросить урон</RowActionItem>
    </section>
  </div>
</template>
<script setup>
import { computed, ref } from 'vue'
import { FormField, SectionLabel, ToggleSwitch } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import WeaponRollOption from './WeaponRollOption.vue'
import RowActionSeparator from '@/shared/ui/RowActionSeparator.vue'
import { damageAttackMode, selectedDamageActions, toggleDamageAction, weaponDamageMenuOptions } from '@/shared/lib/weaponDamageOptions'
const props = defineProps({ actions: { type: Array, default: () => [] }, versatile: Boolean, canAttack: Boolean })
defineEmits(['roll', 'attack'])
const critical = ref(false), twoHanded = ref(false), selected = ref([])
const thrown = computed(() => damageAttackMode(props.actions, selected.value) === 'thrown')
const attackOptions = computed(() => weaponDamageMenuOptions(props.actions, selected.value, false, 'attack'))
const menuOptions = computed(() => weaponDamageMenuOptions(props.actions, selected.value, critical.value))
const options = computed(() => ({ critical: critical.value, twoHanded: props.versatile && twoHanded.value && !thrown.value,
  actionKeys: selectedDamageActions(props.actions, selected.value).map(action => action.key) }))
function select(key, value) { selected.value = toggleDamageAction(props.actions, selected.value, key, value) }
</script>
<style scoped>
.damage-roll-options { display: flex; flex-direction: column; gap: 10px; padding: 8px; min-width: 240px; }
.weapon-roll-section { display: flex; flex-direction: column; gap: 10px; }
</style>
