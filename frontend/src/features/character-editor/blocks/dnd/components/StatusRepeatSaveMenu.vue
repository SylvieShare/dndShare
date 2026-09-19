<template>
  <RowActionSubmenu :min-width="290">
    <template #trigger="{ open }"><RowActionItem :icon="Dices" submenu :submenu-open="open">Повторить спасбросок<template v-if="dc"> · Сл {{ dc }}</template></RowActionItem></template>
    <template #default="{ close }">
      <div class="repeat-save-context">
        <strong>{{ timing }} · {{ ability }}</strong>
        <p v-if="rule.condition">{{ rule.condition }}</p>
        <FormField v-if="!rule.dc && (!dc || instance.source?.kind === 'manual')" label="Сложность" title="Сохраняется от заклинателя при наложении. Для эффекта, добавленного вручную, задайте Сл источника.">
          <FormNumberInput :value="dc" :min="1" :max="100" @change="setDC" />
        </FormField>
        <ToggleSwitch v-if="rule.condition" v-model="confirmed" label="Условия выполнены" />
      </div>
      <D20RollControls scope="saving_throw" :character-context="context" :roll-context="rollContext" :mode="mode.mode" :cancelled="mode.cancelled" :disabled="!dc || !ability || !context.ownerMode || (rule.condition && !confirmed)" roll-label="Бросить; успех снимет эффект" @roll="(mode, excluded) => roll(mode, excluded, close)" />
    </template>
  </RowActionSubmenu>
</template>
<script setup>
import { computed, ref } from 'vue'
import { Dices } from '@lucide/vue'
import { FormField, FormNumberInput, RowActionSubmenu, ToggleSwitch } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import D20RollControls from './D20RollControls.vue'
import { statusSaveBonus } from '@/features/character-editor/lib/statusMechanics'
import { statusRepeatSaveDC, statusRepeatSaveResult, REPEAT_SAVE_TIMING } from '@/features/character-editor/lib/statusRepeatSave'
import { SUGGEST16_TO_STAT, STAT_FULL } from '@/shared/lib/dndStats'
import { itemEventData } from '@/features/character-editor/lib/sessionEventData'
import { useDiceStore } from '@/stores/dice'
const props = defineProps({ context: Object, instance: Object, effect: Object })
const dice = useDiceStore(), confirmed = ref(false)
const rule = computed(() => props.effect.data.repeat_save)
const dc = computed(() => statusRepeatSaveDC(rule.value, props.instance))
const ability = computed(() => STAT_FULL[SUGGEST16_TO_STAT[rule.value.ability]])
const timing = computed(() => REPEAT_SAVE_TIMING[rule.value.timing] || REPEAT_SAVE_TIMING.turn_end)
const rollContext = computed(() => ({ kind: 'saving_throw', abilitySuggestId: Number(rule.value.ability) }))
const mode = computed(() => props.context.characterRolls?.resolve?.('auto', rollContext.value) || { mode: 'normal' })
function setDC(value) {
  if (!props.context.ownerMode || rule.value.dc) return
  props.context.updateValues({ states: props.context.values.states.map(row => row.uid === props.instance.uid ? { ...row, params: { ...row.params, save_dc: value } } : row) })
}
function roll(mode, excluded, close) {
  const ctx = props.context, instance = ctx.values.states?.find(row => row.uid === props.instance.uid)
  if (!ctx.ownerMode || !instance || !ability.value || !statusRepeatSaveDC(rule.value, instance) || (rule.value.condition && !confirmed.value)) return
  dice.rollD20(`Повторный спасбросок: ${props.effect.name}`, statusSaveBonus(ctx, rule.value.ability), mode, {
    actor: ctx.actor, eventData: { ...ctx.eventData, ...itemEventData(props.effect, instance.uid) },
    bonus_formula: ctx.characterDerivedEffects?.rollBonus?.(rollContext.value, excluded),
    resultData(result) {
      const outcome = statusRepeatSaveResult(rule.value, instance, result)
      result.note = outcome.note
      if (outcome.ended) ctx.updateValues({ states: ctx.characterStatuses?.remove?.(instance.uid) || ctx.values.states.filter(row => row.uid !== instance.uid) })
      return { effectSave: outcome }
    },
  })
  close()
}
</script>
<style scoped>
.repeat-save-context { display: grid; gap: 9px; padding: 8px; }
.repeat-save-context strong { color: var(--text-1); font-size: 13px; }
.repeat-save-context p { color: var(--text-2); font-size: 12px; line-height: 1.5; margin: 0; }
</style>
