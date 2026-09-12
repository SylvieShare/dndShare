<template>
  <RowActionSubmenu v-if="hasAttack" :min-width="280">
    <template #trigger="{ open }">
      <RowActionItem action="attack" submenu :submenu-open="open">Бросить на атаку</RowActionItem>
    </template>
    <template #default="{ close }">
      <D20RollControls
        :mode="attackMode.mode" :cancelled="attackMode.cancelled"
        :disabled="ctx.spellcastingBlocked" action="attack" roll-label="Бросить на атаку"
        @roll="mode => rollAttack(mode, close)"
      />
    </template>
  </RowActionSubmenu>
  <RowActionSubmenu v-for="kind in rollKinds" :key="kind" :min-width="280">
    <template #trigger="{ open }">
      <RowActionItem :action="kind === 'damage' ? 'damage' : 'revive'" submenu :submenu-open="open">
        {{ kind === 'damage' ? 'Бросить на урон' : 'Бросить на лечение' }}
      </RowActionItem>
    </template>
    <template #default="{ close }">
      <div class="spell-roll-controls">
        <FormField v-if="kind === 'damage' && hasAttack" label="Критическое попадание" title="Удваивает кости урона, но не постоянные прибавки.">
          <ToggleSwitch v-model="critical" aria-label="Критическое попадание" />
        </FormField>
        <DamageFormulaPreview :label="kind === 'damage' ? 'Итоговый урон' : 'Итоговое лечение'" :aria-label="kind === 'damage' ? 'Итоговая формула урона' : 'Итоговая формула лечения'" :expression="kind === 'damage' ? damagePreview : healPreview" />
        <RowActionItem :action="kind === 'damage' ? 'damage' : 'revive'" :disabled="ctx.spellcastingBlocked" @click="roll(kind, close)">
          {{ kind === 'damage' ? 'Бросить на урон' : 'Бросить на лечение' }}
        </RowActionItem>
      </div>
    </template>
  </RowActionSubmenu>
</template>
<script setup>
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
const damagePreview = computed(() => ctx.spellDamagePreview(props.entry, props.castLevel, hasAttack.value && critical.value))
const healPreview = computed(() => ctx.spellHealPreview(props.entry, props.castLevel))
const rollKinds = computed(() => [damagePreview.value && 'damage', healPreview.value && 'heal'].filter(Boolean))

function rollAttack(mode, close) {
  if (ctx.spellcastingBlocked) return
  ctx.rollSpellAttack(props.entry, mode)
  close()
  emit('close')
}
function roll(kind, close) {
  if (ctx.spellcastingBlocked) return
  if (kind === 'damage') ctx.rollSpellDamage(props.entry, props.castLevel, hasAttack.value && critical.value)
  else ctx.rollSpellHeal(props.entry, props.castLevel)
  close()
  emit('close')
}
</script>
<style scoped>
.spell-roll-controls { display: flex; flex-direction: column; gap: 10px; padding: 8px; min-width: 0; }
</style>
