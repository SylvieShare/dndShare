<template>
  <WeaponRollControls
    :scope="scope" :weapon-uid="weaponUid" :uses="uses" :preview="previewFormula"
    :options="menuOptions(scope)" :bonus-action-option="availableBonusAction" :versatile="versatile" :thrown="thrown"
    v-model:attack-roll-mode="attackRollMode" v-model:use-key="useKey" v-model:critical="critical"
    v-model:two-handed="twoHanded" v-model:bonus-action="bonusAction"
    @select="select" @amount="setAmount"
    @roll="excludedBonuses => emit(scope === 'attack' ? 'attack' : 'roll', { ...options, excludedBonuses })"
    @roll-step="step => emit('roll-step', step)"
  />
</template>
<script setup>
import { changeSelectedTarget } from '@/features/character-editor/lib/selectedTarget'
import { computed, inject, ref, unref, watch } from 'vue'
import WeaponRollControls from './WeaponRollControls.vue'
import { damageAttackMode, selectedDamageActions, toggleDamageAction, weaponDamageMenuOptions } from '@/shared/lib/weaponDamageOptions'
const props = defineProps({ weaponUid: String, actions: { type: Array, default: () => [] }, versatile: Boolean, scope: { type: String, required: true }, preview: Function, bonusActionOption: Function, uses: { type: Array, default: () => [] } })
const charCtx = inject('charCtx', {})
const selectedKeys = computed(() => [...selected.value, ...props.actions.filter(action => action.target_choice?.selected).map(action => action.key)])
const emit = defineEmits(['roll', 'attack', 'roll-step'])
const critical = ref(false), twoHanded = ref(false), bonusAction = ref(false), selected = ref([]), amounts = ref({}), useKey = ref(''), attackRollMode = ref('auto')
const thrown = computed(() => props.uses.find(use => use.key === useKey.value)?.attack_mode === 'thrown' || damageAttackMode(props.actions, selectedKeys.value) === 'thrown')
const menuOptions = scope => weaponDamageMenuOptions(props.actions, selectedKeys.value, critical.value, scope, twoHanded.value, amounts.value)
const availableBonusAction = computed(() => props.bonusActionOption?.({ actionKeys: selectedKeys.value }) || null)
watch(availableBonusAction, option => { if (!option) bonusAction.value = false })
const options = computed(() => ({ critical: critical.value, twoHanded: props.versatile && twoHanded.value && !thrown.value && !bonusAction.value,
  bonusAction: bonusAction.value && !!availableBonusAction.value,
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
