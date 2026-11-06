<template>
  <div class="weapon-roll-controls" :class="{ 'weapon-roll-controls--attack': scope === 'attack' }" role="group" :aria-label="scope === 'attack' ? 'Атака' : 'Урон'">
    <div v-if="weaponTitle" class="weapon-roll-heading">
      <ItemIcon v-if="weapon?.iconImageUrl || weapon?.svg" :item="weapon" :size="40" />
      <Swords v-else :size="34" aria-hidden="true" />
      <div><strong>{{ weaponTitle }} · {{ scope === 'attack' ? 'Атака' : 'Урон' }}</strong>
        <small v-if="summary?.ability">{{ summary.ability }}</small></div>
      <b v-if="scope === 'attack' && summary">{{ signed(summary.bonus) }}</b>
    </div>
    <RollModePicker v-if="scope === 'attack'" :model-value="attackRollMode" neutral-mode="auto" @update:model-value="emit('update:attackRollMode', $event)" />
    <template v-if="scope === 'damage'">
      <FormField label="Критическое попадание" title="Удваивает кости урона, но не постоянные прибавки.">
        <ToggleSwitch :model-value="critical" aria-label="Критическое попадание" @update:model-value="emit('update:critical', $event)" />
      </FormField>
      <FormField v-if="bonusActionOption" label="Урон бонусным действием" :title="bonusActionOption.hint">
        <ToggleSwitch :model-value="bonusAction" :disabled="twoHanded" aria-label="Урон бонусным действием" @update:model-value="!twoHanded && emit('update:bonusAction', $event)" />
      </FormField>
      <FormField v-if="versatile" label="Двумя руками" title="Использует кость урона для хвата двумя руками.">
        <ToggleSwitch :model-value="twoHanded" :disabled="thrown || bonusAction" aria-label="Двумя руками" @update:model-value="!thrown && !bonusAction && emit('update:twoHanded', $event)" />
      </FormField>
    </template>
    <ChoiceCard v-for="option in (scope === 'attack' && useKey ? [] : modes)" :key="option.key"
      layout="inline" :label="option.label" :description="(option.range || '20/60') + ' фт.'"
      :title="option.hint" :model-value="option.checked" :disabled="option.disabled"
      @update:model-value="checked => emit('select', option.key, checked)">
      <template #icon><Crosshair aria-hidden="true" /></template>
    </ChoiceCard>
    <RowActionSeparator v-if="hasCustomOptions" />
    <WeaponBonusTransferSelector v-if="scope === 'attack' && transfer?.active" :transfer="transfer" :disabled="!charCtx.ownerMode" @change="setAmount" />
    <WeaponRollOption v-for="use in scope === 'attack' ? uses : damageUses" :key="use.key" :option="useOption(use)" @select="(key, value) => emit('update:useKey', value ? key : '')" />
    <WeaponRollOption v-for="option in (scope === 'attack' && useKey ? [] : extras)" :key="option.key" :option="option" @select="(key, value) => emit('select', key, value)" @amount="(key, value) => emit('amount', key, value)" />
    <RollBonusOptions v-if="scope === 'attack'" scope="attack" v-model="excludedBonuses" />
    <WeaponFormulaPreview v-if="summary && formulaRows.length" :rows="formulaRows" :scope="scope" />
    <DamageFormulaPreview v-else-if="!summary && scope === 'damage'" :expression="preview" />
    <small v-if="blocked" role="alert">{{ blocked.resourceError }}</small>
    <RowActionItem :disabled="!!blocked" :action="scope === 'attack' ? 'attack' : 'damage'" @click="!blocked && emit('roll', excludedBonuses)">{{ scope === 'attack' ? 'Бросить на атаку' : 'Бросить на урон' }}</RowActionItem>
    <WeaponUseDamageMenu v-if="scope === 'damage'" :weapon-uid="weaponUid" :uses="uses" @roll="emit('roll-step', $event)" />
  </div>
</template>
<script setup>
import { Crosshair, Swords } from '@lucide/vue'
import { signedOrZero as signed } from '@/shared/lib/dnd'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import WeaponFormulaPreview from './WeaponFormulaPreview.vue'
import RollModePicker from './RollModePicker.vue'
import RollBonusOptions from './RollBonusOptions.vue'
import WeaponBonusTransferSelector from './WeaponBonusTransferSelector.vue'
import { ChoiceCard, FormField, ToggleSwitch } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import RowActionSeparator from '@/shared/ui/RowActionSeparator.vue'
import DamageFormulaPreview from './DamageFormulaPreview.vue'
import WeaponRollOption from './WeaponRollOption.vue'
import WeaponUseDamageMenu from './WeaponUseDamageMenu.vue'
import { weaponDamageActionFormula, weaponDamageActionParts } from '@/shared/lib/weaponDamageOptions'
import { computed, inject, toRef, ref } from 'vue'
import { useWeaponBonusTransfer } from '../composables/useWeaponBonusTransfer'
const props = defineProps({ weapon: Object, weaponTitle: String, summary: Object, weaponUid: String, attackRollMode: { type: String, default: 'auto' }, uses: { type: Array, default: () => [] }, useKey: { type: String, default: '' }, scope: { type: String, default: 'damage' }, options: { type: Array, default: () => [] }, critical: Boolean, twoHanded: Boolean, bonusAction: Boolean, bonusActionOption: Object, versatile: Boolean, thrown: Boolean, preview: { type: String, default: '' } })
const excludedBonuses = ref([])
const charCtx = inject('charCtx', {})
const formulaRows = computed(() => {
  if (props.scope === 'damage') return props.summary.parts
  const bonuses = (charCtx.characterDerivedEffects?.rollBonusOptions?.({ kind: 'attack' }) || [])
    .filter(rule => !excludedBonuses.value.includes(rule.key))
    .map(rule => ({ source: rule.source_label || 'Бонус', expression: rule.formula }))
  const mode = props.summary.mode
  return [{ source: mode === 'advantage' ? 'Преимущество' : mode === 'disadvantage' ? 'Помеха' : 'Атака',
    expression: ['advantage', 'disadvantage'].includes(mode) ? '2d20' : '1d20' }, ...props.summary.parts, ...bonuses]
})
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
const extras = computed(() => props.options.filter(option => !option.mode))
const chosenUse = computed(() => props.uses.find(use => use.key === props.useKey))
const blocked = computed(() => props.useKey && (!chosenUse.value || chosenUse.value.error)
  ? { resourceError: chosenUse.value?.error || 'Режим недоступен.' }
  : props.scope === 'damage' && props.options.find(option => option.checked && option.resourceError))
const emit = defineEmits(['update:attackRollMode', 'update:useKey', 'update:critical', 'update:twoHanded', 'update:bonusAction', 'select', 'amount', 'roll', 'roll-step'])
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
</style>
