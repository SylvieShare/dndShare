<template>
  <RowActionSubmenu v-if="entry.item?.data?.damage?.save_ability && (!options.length || entry.item.data.damage.save_manual)" :min-width="280">
    <template #trigger="{ open }"><RowActionItem action="spell" submenu :submenu-open="open">Спасбросок · Сл {{ ctx.spellSaveDC(entry) }}</RowActionItem></template>
    <template #default="{ close }"><SpellCastControls :entry="entry" :cast-level="castLevel" spend-by-default v-slot="cast">
      <RowActionItem action="spell" :disabled="cast.disabled" @click="requestSave(close, cast)">Объявить спасбросок</RowActionItem>
    </SpellCastControls></template>
  </RowActionSubmenu>
  <RowActionSubmenu v-if="hasAttack" :min-width="280">
    <template #trigger="{ open }">
      <RowActionItem action="attack" submenu :submenu-open="open">Бросить на атаку</RowActionItem>
    </template>
    <template #default="{ close }">
      <SpellCastControls :entry="entry" :cast-level="castLevel" spend-by-default v-slot="cast">
      <small v-if="hasSequence">После атаки выберите цель и продолжайте броски в хронике сессии.</small>
      <SpellDamageTypeChoice :entry="entry" :disabled="ctx.spellcastingBlocked" />
      <D20RollControls scope="attack"
        :mode="attackMode.mode" :cancelled="attackMode.cancelled"
        :disabled="cast.disabled || !typeReady(entry)" action="attack" :roll-label="cast.spend ? 'Бросить и потратить ячейку' : 'Бросить на атаку'"
        @roll="(mode, excluded) => rollAttack(mode, close, cast, excluded)"
      />
      </SpellCastControls>
    </template>
  </RowActionSubmenu>
  <RowActionSubmenu v-for="option in options" :key="option.key" :min-width="280">
    <template #trigger="{ open }">
      <RowActionItem :action="option.kind === 'damage' ? 'damage' : option.kind === 'heal' ? 'revive' : 'feature-damage'" submenu :submenu-open="open">
        {{ rollLabel(option) }}
      </RowActionItem>
    </template>
    <template #default="{ close }">
      <SpellCastControls :entry="entry" :cast-level="castLevel" :spend-by-default="!hasAttack && !option.rule.range_attack" v-slot="cast">
      <div class="spell-roll-controls">
        <SpellDamageTypeChoice v-if="option.kind === 'damage'" :entry="option.entry" :disabled="ctx.spellcastingBlocked" />
        <FormField v-if="option.kind === 'damage' && option.rule.range_attack" label="Критическое попадание" title="Удваивает кости урона, но не постоянные прибавки.">
          <ToggleSwitch v-model="critical" aria-label="Критическое попадание" />
        </FormField>
        <DamageFormulaPreview :default-color="option.kind === 'heal' ? 'var(--success)' : undefined" :label="option.primary ? option.kind === 'damage' ? 'Итоговый урон' : 'Итоговое лечение' : option.label" :aria-label="option.kind === 'damage' ? 'Итоговая формула урона' : option.kind === 'heal' ? 'Итоговая формула лечения' : 'Итоговая формула эффекта'" :expression="preview(option, cast.castLevel)" />
        <small v-if="option.kind === 'damage' && spellInstances(option.entry.item, cast.castLevel, ctx.charLevel) > 1">Урон одного снаряда/луча. Всего: {{ spellInstances(option.entry.item, cast.castLevel, ctx.charLevel) }}.</small>
        <RowActionItem :action="option.kind === 'damage' ? 'damage' : option.kind === 'heal' ? 'revive' : 'feature-damage'" :disabled="cast.disabled || !optionReady(option)" @click="roll(option, close, cast)">
          {{ cast.spend ? 'Бросить и потратить ячейку' : rollLabel(option) }}
        </RowActionItem>
      </div>
      </SpellCastControls>
    </template>
  </RowActionSubmenu>
</template>
<script setup>
import { useSessionEventsStore } from '@/stores/sessionEvents'
import SpellDamageTypeChoice from './SpellDamageTypeChoice.vue'
import { spellRollOptions } from '../lib/spellRollOptions'
import { spellInstances } from '../lib/spellScaling'
import SpellCastControls from './SpellCastControls.vue'
import { computed, inject, ref } from 'vue'
import { FormField, RowActionSubmenu, ToggleSwitch } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import D20RollControls from './D20RollControls.vue'
import DamageFormulaPreview from './DamageFormulaPreview.vue'

const props = defineProps({ entry: { type: Object, required: true }, castLevel: { type: Number, required: true } })
const emit = defineEmits(['close'])
const ctx = inject('spellsBlockCtx')
const critical = ref(false)
const events = useSessionEventsStore()
const hasSequence = computed(() => !!events.sessionUuid && !!(props.entry.item?.data?.damage?.roll_table || props.entry.item?.data?.damage?.attack_chain))
const typeReady = entry => ctx.spellDamageTypes?.ready(entry) !== false
const optionReady = option => option.kind !== 'damage' || typeReady(option.entry)
const hasAttack = computed(() => !!props.entry.item?.data?.damage?.range_attack)
const attackMode = computed(() => ctx.spellAttackMode(props.entry))
const options = computed(() => spellRollOptions(props.entry).filter(option => !(hasSequence.value && option.primary && option.kind === 'damage') && !(option.primary && option.kind === 'heal' && (props.entry.item?.data?.heal?.apply !== false || props.entry.item?.data?.item_creation?.length))))
const rollLabel = option => option.primary ? option.kind === 'heal' ? 'Бросить на лечение' : 'Бросить на урон' : `Бросить: ${option.label}`
const preview = (option, level) => option.kind === 'heal' ? ctx.spellHealPreview(option.entry, level)
  : ctx.spellDamagePreview(option.entry, level, option.kind === 'damage' && option.rule.range_attack && critical.value)

async function requestSave(close, cast) {
  if (ctx.spellcastingBlocked || !await cast.commit()) return
  await ctx.requestSpellSave(props.entry)
  close(); emit('close')
}
async function rollAttack(mode, close, cast, excluded) {
  if (ctx.spellcastingBlocked || !typeReady(props.entry) || !await cast.commit()) return
  ctx.rollSpellAttack(props.entry, mode, excluded, cast.castLevel)
  close()
  emit('close')
}
async function roll(option, close, cast) {
  if (ctx.spellcastingBlocked || !optionReady(option) || !await cast.commit()) return
  if (option.kind === 'damage') ctx.rollSpellDamage(option.entry, cast.castLevel, option.rule.range_attack && critical.value)
  else if (option.kind === 'heal') ctx.rollSpellHeal(option.entry, cast.castLevel)
  else ctx.rollSpellEffect(option.entry, cast.castLevel)
  close()
  emit('close')
}
</script>
<style scoped>
.spell-roll-controls { display: flex; flex-direction: column; gap: 10px; padding: 8px; min-width: 0; }
</style>
