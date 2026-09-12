<template>
  <RowActionSubmenu v-if="hasAttack" :min-width="280">
    <template #trigger="{ open }">
      <RowActionItem action="attack" submenu :submenu-open="open">Бросить на атаку</RowActionItem>
    </template>
    <template #default="{ close }">
      <SpellCastControls :entry="entry" :cast-level="castLevel" spend-by-default v-slot="cast">
      <D20RollControls
        :mode="attackMode.mode" :cancelled="attackMode.cancelled"
        :disabled="cast.disabled" action="attack" :roll-label="cast.spend ? 'Бросить и потратить ячейку' : 'Бросить на атаку'"
        @roll="mode => rollAttack(mode, close, cast.commit)"
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
        <FormField v-if="option.kind === 'damage' && option.rule.range_attack" label="Критическое попадание" title="Удваивает кости урона, но не постоянные прибавки.">
          <ToggleSwitch v-model="critical" aria-label="Критическое попадание" />
        </FormField>
        <DamageFormulaPreview :label="option.primary ? option.kind === 'damage' ? 'Итоговый урон' : 'Итоговое лечение' : option.label" :aria-label="option.kind === 'damage' ? 'Итоговая формула урона' : option.kind === 'heal' ? 'Итоговая формула лечения' : 'Итоговая формула эффекта'" :expression="preview(option, cast.castLevel)" />
        <small v-if="option.kind === 'damage' && spellInstances(option.entry.item, cast.castLevel, ctx.charLevel) > 1">Урон одного снаряда/луча. Всего: {{ spellInstances(option.entry.item, cast.castLevel, ctx.charLevel) }}.</small>
        <RowActionItem :action="option.kind === 'damage' ? 'damage' : option.kind === 'heal' ? 'revive' : 'feature-damage'" :disabled="cast.disabled" @click="roll(option, close, cast)">
          {{ cast.spend ? 'Бросить и потратить ячейку' : rollLabel(option) }}
        </RowActionItem>
      </div>
      </SpellCastControls>
    </template>
  </RowActionSubmenu>
</template>
<script setup>
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
const hasAttack = computed(() => !!props.entry.item?.data?.damage?.range_attack)
const attackMode = computed(() => ctx.spellAttackMode(props.entry))
const options = computed(() => spellRollOptions(props.entry))
const rollLabel = option => option.primary ? option.kind === 'heal' ? 'Бросить на лечение' : 'Бросить на урон' : `Бросить: ${option.label}`
const preview = (option, level) => option.kind === 'heal' ? ctx.spellHealPreview(option.entry, level)
  : ctx.spellDamagePreview(option.entry, level, option.kind === 'damage' && option.rule.range_attack && critical.value)

function rollAttack(mode, close, commit) {
  if (ctx.spellcastingBlocked || !commit()) return
  ctx.rollSpellAttack(props.entry, mode)
  close()
  emit('close')
}
function roll(option, close, cast) {
  if (ctx.spellcastingBlocked || !cast.commit()) return
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
