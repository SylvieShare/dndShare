<template>
  <template v-if="canAttack">
    <RowActionSubmenu v-for="scope in ['attack', 'damage']" :key="scope" :label="scope === 'attack' ? 'Бросить на атаку' : 'Бросить на урон'" :min-width="280">
      <template #trigger="{ open }">
        <RowActionItem :action="scope" submenu :submenu-open="open">{{ scope === 'attack' ? 'Бросить на атаку' : 'Бросить на урон' }}</RowActionItem>
      </template>
      <template #default="{ close }">
        <WeaponRollControls :scope="scope" :options="menuOptions(scope)" v-model:critical="critical" v-model:two-handed="twoHanded" :versatile="versatile" :thrown="thrown" @select="select" @roll="close(); emit(scope === 'attack' ? 'attack' : 'roll', options)" />
      </template>
    </RowActionSubmenu>
  </template>
  <WeaponRollControls v-else :options="menuOptions('damage')" v-model:critical="critical" v-model:two-handed="twoHanded" :versatile="versatile" :thrown="thrown" @select="select" @roll="emit('roll', options)" />
</template>
<script setup>
import { computed, ref } from 'vue'
import { RowActionSubmenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import WeaponRollControls from './WeaponRollControls.vue'
import { damageAttackMode, selectedDamageActions, toggleDamageAction, weaponDamageMenuOptions } from '@/shared/lib/weaponDamageOptions'
const props = defineProps({ actions: { type: Array, default: () => [] }, versatile: Boolean, canAttack: Boolean })
const emit = defineEmits(['roll', 'attack'])
const critical = ref(false), twoHanded = ref(false), selected = ref([])
const thrown = computed(() => damageAttackMode(props.actions, selected.value) === 'thrown')
const menuOptions = scope => weaponDamageMenuOptions(props.actions, selected.value, critical.value, scope, twoHanded.value)
const options = computed(() => ({ critical: critical.value, twoHanded: props.versatile && twoHanded.value && !thrown.value,
  actionKeys: selectedDamageActions(props.actions, selected.value).map(action => action.key) }))
function select(key, value) {
  if (value && twoHanded.value && props.actions.find(action => action.key === key)?.attack_mode === 'thrown') return
  selected.value = toggleDamageAction(props.actions, selected.value, key, value) }
</script>
