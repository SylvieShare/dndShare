<template>
  <div class="weapon-roll-controls" :class="{ 'weapon-roll-controls--attack': scope === 'attack', 'weapon-roll-controls--dialog': dialog }" role="group" :aria-label="scope === 'attack' ? 'Атака' : 'Урон'">
    <div v-if="weaponTitle && !dialog" class="weapon-roll-heading">
      <ItemIcon v-if="weapon?.iconImageUrl || weapon?.svg" :item="weapon" :size="40" />
      <Swords v-else :size="34" aria-hidden="true" />
      <div><strong>{{ weaponTitle }} · {{ scope === 'attack' ? 'Атака' : 'Урон' }}</strong>
        <small v-if="summary?.ability">{{ summary.ability }}</small></div>
      <b v-if="scope === 'attack' && summary">{{ signed(summary.bonus) }}</b>
    </div>
    <RollModePicker v-if="scope === 'attack'" :model-value="attackRollMode" neutral-mode="auto" @update:model-value="emit('update:attackRollMode', $event)" />
    <div v-if="baseOptions.length" class="weapon-roll-options dnd-roll-option-strip" role="group" :aria-label="scope === 'damage' ? 'Параметры урона' : 'Способ атаки'">
      <ChoiceCard v-for="option in baseOptions" :key="option.key" layout="icon" centered selection-indicator="outline"
        :label="option.label" :description="option.description" :title="option.hint"
        :model-value="option.checked" :disabled="option.disabled" :color="option.color"
        @update:model-value="checked => !option.disabled && option.select(checked)">
        <template #icon><component :is="option.icon" aria-hidden="true" /></template>
      </ChoiceCard>
    </div>
    <RollBonusOptions :scope="scope === 'attack' ? 'attack' : undefined" :has-additional-options="!!hasCustomOptions"
      :model-value="excludedBonuses" @update:model-value="emit('update:excludedBonuses', $event)">
      <template v-if="additionalUses.length || toggleExtras.length" #default>
        <WeaponRollOption v-for="use in additionalUses" :key="use.key" :option="useOption(use)" @select="(key, value) => emit('update:useKey', value ? key : '')" />
        <WeaponRollOption v-for="option in toggleExtras" :key="option.key" :option="option" @select="(key, value) => emit('select', key, value)" />
      </template>
      <template v-if="(scope === 'attack' && transfer?.active) || countedExtras.length" #details>
        <WeaponBonusTransferSelector v-if="scope === 'attack' && transfer?.active" :transfer="transfer" :disabled="!charCtx.ownerMode" @change="setAmount" />
        <WeaponRollOption v-for="option in countedExtras" :key="option.key" :option="option" @amount="(key, value) => emit('amount', key, value)" />
      </template>
    </RollBonusOptions>
    <small v-if="blocked" role="alert">{{ blocked.resourceError }}</small>
    <ActionButton v-if="dialog" :disabled="!!blocked" @click="!blocked && emit('roll')">{{ scope === 'attack' ? 'Бросить на атаку' : 'Бросить на урон' }}</ActionButton>
    <RowActionItem v-else :disabled="!!blocked" :action="scope === 'attack' ? 'attack' : 'damage'" @click="!blocked && emit('roll')">{{ scope === 'attack' ? 'Бросить на атаку' : 'Бросить на урон' }}</RowActionItem>
    <WeaponUseDamageMenu v-if="scope === 'damage'" :dialog="dialog" :weapon-uid="weaponUid" :uses="uses" @roll="emit('roll-step', $event)" />
  </div>
</template>
<script setup>
import { Crosshair, Swords, Hand, Sparkles, Zap } from '@lucide/vue'
import { signedOrZero as signed } from '@/shared/lib/dnd'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import RollModePicker from './RollModePicker.vue'
import RollBonusOptions from './RollBonusOptions.vue'
import WeaponBonusTransferSelector from './WeaponBonusTransferSelector.vue'
import { ActionButton, ChoiceCard } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import WeaponRollOption from './WeaponRollOption.vue'
import WeaponUseDamageMenu from './WeaponUseDamageMenu.vue'
import { weaponDamageActionFormula, weaponDamageActionParts } from '@/shared/lib/weaponDamageOptions'
import { computed, inject, toRef } from 'vue'
import { useWeaponBonusTransfer } from '../composables/useWeaponBonusTransfer'
import './RollOptionTiles.css'
const props = defineProps({ dialog: Boolean, weapon: Object, weaponTitle: String, summary: Object, weaponUid: String,
  attackRollMode: { type: String, default: 'auto' }, uses: { type: Array, default: () => [] }, useKey: { type: String, default: '' },
  scope: { type: String, default: 'damage' }, options: { type: Array, default: () => [] }, excludedBonuses: { type: Array, default: () => [] },
  critical: Boolean, twoHanded: Boolean, bonusAction: Boolean, bonusActionOption: Object, versatile: Boolean, thrown: Boolean })
const charCtx = inject('charCtx', {})
const { transfer, setAmount } = useWeaponBonusTransfer(charCtx, toRef(props, 'weaponUid'))
const hasCustomOptions = computed(() => props.scope === 'attack'
  ? transfer.value?.active || props.uses.length > 0 || (!props.useKey && extras.value.length > 0)
  : extras.value.length > 0 || damageUses.value.length > 0)
const damageUses = computed(() => props.uses.filter(use => !use.active && use.steps.filter(step => step.kind === 'weapon_damage').length === 1))
function useOption(use) {
  const checked = props.useKey === use.key
  const condition = use.attack_mode === 'melee' ? 'Рукопашная атака' : `Дистанция до ${use.range_ft} футов`
  const step = props.scope === 'damage' && use.steps.find(step => step.kind === 'weapon_damage')
  const formula = step ? weaponDamageActionFormula(step, props.critical).replace('d', 'к') : ''
  return { key: use.key, label: use.title, checked, disabled: !checked && (use.disabled || !!props.useKey || (props.twoHanded && use.attack_mode === 'thrown')),
    damageParts: step ? weaponDamageActionParts(step, props.critical) : [], formula: `+${formula}`, formulaPrefix: '+', formulaVerb: 'Добавит',
    condition, hint: [condition, use.error, use.resource_cost && `Расход при ${step ? 'первом броске применения' : 'атаке, даже при промахе'}: ${use.resource_cost}.`].filter(Boolean).join(' · '),
    resourceCost: use.resource_cost ? { amount: use.resource_cost, color: use.resource?.color_point, unavailable: use.disabled } : null }
}
const modes = computed(() => props.options.filter(option => option.mode))
const baseOptions = computed(() => [
  ...(props.scope === 'damage' ? [
    { key: 'critical', label: 'Критическое попадание', icon: Sparkles, color: 'var(--warning)', checked: props.critical,
      hint: 'Удваивает кости урона, но не постоянные прибавки.', select: value => emit('update:critical', value) },
    ...(props.versatile ? [{ key: 'two-handed', label: 'Двумя руками', icon: Hand, checked: props.twoHanded, disabled: props.thrown || props.bonusAction,
      hint: 'Использует кость урона для хвата двумя руками.', select: value => emit('update:twoHanded', value) }] : []),
    ...(props.bonusActionOption ? [{ key: 'bonus-action', label: 'Урон бонусным действием', icon: Zap, checked: props.bonusAction, disabled: props.twoHanded,
      hint: props.bonusActionOption.hint, select: value => emit('update:bonusAction', value) }] : []),
  ] : []),
  ...(props.scope === 'attack' && props.useKey ? [] : modes.value).map(option => ({ ...option, icon: Crosshair,
    description: (option.range || '20/60') + ' фт.', select: value => emit('select', option.key, value) })),
])
const extras = computed(() => props.options.filter(option => !option.mode))
const additionalUses = computed(() => props.scope === 'attack' ? props.uses : damageUses.value)
const availableExtras = computed(() => props.scope === 'attack' && props.useKey ? [] : extras.value)
const toggleExtras = computed(() => availableExtras.value.filter(option => !option.units))
const countedExtras = computed(() => availableExtras.value.filter(option => option.units))
const chosenUse = computed(() => props.uses.find(use => use.key === props.useKey))
const blocked = computed(() => props.useKey && (!chosenUse.value || chosenUse.value.error)
  ? { resourceError: chosenUse.value?.error || 'Режим недоступен.' }
  : props.scope === 'damage' && props.options.find(option => option.checked && option.resourceError))
const emit = defineEmits(['update:attackRollMode', 'update:useKey', 'update:critical', 'update:twoHanded', 'update:bonusAction', 'update:excludedBonuses', 'select', 'amount', 'roll', 'roll-step'])
</script>
<style scoped>
.weapon-roll-heading { display: flex; align-items: center; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--border-strong); }
.weapon-roll-heading > svg { flex: none; color: var(--text-2); }
.weapon-roll-heading div { min-width: 0; flex: 1; overflow-wrap: anywhere; }
.weapon-roll-heading small { display: block; color: var(--text-muted); margin-top: 3px; }
.weapon-roll-controls {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-label);
  padding: var(--spacing-small);
  width: var(--layout-roll-mode-menu-width);
  max-width: min(100%, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  min-width: 0;
  overflow-y: auto;
  box-sizing: border-box;
}
.weapon-roll-controls--dialog {width:100%;max-width:none;max-height:none;padding:0;overflow:visible}
</style>
