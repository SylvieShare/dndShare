<template>
  <RowActionSubmenu v-if="entry.item?.data?.damage?.save_ability && (!options.some(option => option.primary && option.kind === 'damage') || entry.item.data.damage.save_manual)" :min-width="280">
    <template #trigger="{ open }"><RowActionItem action="spell" submenu :submenu-open="open">Спасбросок · Сл {{ ctx.spellSaveDC(entry) }}</RowActionItem></template>
    <template #default="{ close }"><SpellCastControls :entry="entry" :cast-level="castLevel" spend-by-default v-slot="cast">
      <RowActionItem action="spell" :disabled="cast.disabled" @click="requestSave(close, cast)">Объявить спасбросок</RowActionItem>
    </SpellCastControls></template>
  </RowActionSubmenu>
  <RowActionItem v-if="hasAttack" action="attack" aria-haspopup="dialog" @click="emit('open', 'attack')">Бросить на атаку</RowActionItem>
  <RowActionItem v-for="option in options" :key="option.key"
    :action="option.kind === 'damage' ? 'damage' : option.kind === 'heal' ? 'revive' : 'feature-damage'"
    aria-haspopup="dialog" @click="emit('open', option.key)">{{ spellRollLabel(option) }}</RowActionItem>
</template>
<script setup>
import { inject, toRef } from 'vue'
import { RowActionSubmenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import SpellCastControls from './SpellCastControls.vue'
import { useSpellRollOptions, spellRollLabel } from '../composables/useSpellRollOptions'

const props = defineProps({ entry: { type: Object, required: true }, castLevel: { type: Number, required: true } })
const emit = defineEmits(['open', 'close'])
const ctx = inject('spellsBlockCtx')
const { hasAttack, options } = useSpellRollOptions(toRef(props, 'entry'))
async function requestSave(close, cast) {
  if (ctx.spellcastingBlocked || !await cast.commit()) return
  await ctx.requestSpellSave(props.entry)
  close(); emit('close')
}
</script>
