<template>
  <template v-if="canAttack">
    <RowActionSubmenu v-for="scope in ['attack', 'damage']" :key="scope" :min-width="280">
      <template #trigger="{ open }">
        <RowActionItem :action="scope" submenu :submenu-open="open">{{ scope === 'attack' ? 'Бросить на атаку' : 'Бросить на урон' }}</RowActionItem>
      </template>
      <template #default="{ close }">
        <WeaponRollControls :scope="scope" :weapon-uid="weaponUid" :uses="uses" v-model:attack-roll-mode="attackRollMode" v-model:use-key="useKey" :preview="previewFormula" :options="menuOptions(scope)" v-model:critical="critical" v-model:two-handed="twoHanded" :versatile="versatile" :thrown="thrown" @select="select" @amount="setAmount" @roll="close(); emit(scope === 'attack' ? 'attack' : 'roll', options)" />
      </template>
    </RowActionSubmenu>
  </template>
  <WeaponRollControls v-else :preview="previewFormula" :options="menuOptions('damage')" v-model:critical="critical" v-model:two-handed="twoHanded" :versatile="versatile" :thrown="thrown" @select="select" @amount="setAmount" @roll="emit('roll', options)" />
</template>
<script setup>
import { changeSelectedTarget } from '@/features/character-editor/lib/selectedTarget'
import { computed, inject, ref, unref } from 'vue'
import { RowActionSubmenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import WeaponRollControls from './WeaponRollControls.vue'
import { damageAttackMode, selectedDamageActions, toggleDamageAction, weaponDamageMenuOptions } from '@/shared/lib/weaponDamageOptions'
const props = defineProps({ weaponUid: String, actions: { type: Array, default: () => [] }, versatile: Boolean, canAttack: Boolean, preview: Function, uses: { type: Array, default: () => [] } })
const charCtx = inject('charCtx', {})
const selectedKeys = computed(() => [...selected.value, ...props.actions.filter(action => action.target_choice?.selected).map(action => action.key)])
const emit = defineEmits(['roll', 'attack'])
const critical = ref(false), twoHanded = ref(false), selected = ref([]), amounts = ref({}), useKey = ref(''), attackRollMode = ref('auto')
const thrown = computed(() => damageAttackMode(props.actions, selectedKeys.value) === 'thrown')
const menuOptions = scope => weaponDamageMenuOptions(props.actions, selectedKeys.value, critical.value, scope, twoHanded.value, amounts.value)
const options = computed(() => ({ critical: critical.value, twoHanded: props.versatile && twoHanded.value && !thrown.value,
  attackRollMode: attackRollMode.value, weaponUseKey: useKey.value, actionAmounts: { ...amounts.value },
  actionKeys: selectedDamageActions(props.actions, selectedKeys.value).map(action => action.key) }))
const previewFormula = computed(() => props.preview?.(options.value) || '')
function setAmount(key, amount) {
  const option = menuOptions('damage').find(row => row.key === key)
  if (!option?.units || !Number.isInteger(amount) || amount < 0 || amount > option.units.max) return
  if (amount > option.units.value && (option.disabled || amount > option.units.available)) return
  amounts.value = { ...amounts.value, [key]: amount }
  select(key, amount > 0)
}
function select(key, value) {
  const target = props.actions.find(action => action.key === key)?.target_choice
  if (target) {
    const patch = changeSelectedTarget(unref(charCtx.values) || {}, unref(charCtx.characterResources?.itemsById) || new Map(), target.uid, 'select', { id: target.id, selected: value }, !!charCtx.ownerMode)
    if (Object.keys(patch).length) charCtx.updateValues(patch)
    return
  }
  if (value && twoHanded.value && props.actions.find(action => action.key === key)?.attack_mode === 'thrown') return
  selected.value = toggleDamageAction(props.actions, selected.value, key, value) }
</script>
