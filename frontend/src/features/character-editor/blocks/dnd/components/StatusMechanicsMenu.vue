<template>
  <template v-if="ctx.ownerMode && instance">
    <StatusRepeatSaveMenu v-if="effect.data?.repeat_save && !instance.external_only" :context="ctx" :instance="instance" :effect="effect" />
    <RowActionItem v-if="ongoing" :icon="Dices" :disabled="busy" @click="runOngoing">
      {{ damagePhase ? (phase === 'initial_damage' ? 'При употреблении' : 'Начало хода') + ': ' + count + ongoing.dice : (phase === 'initial_save' ? 'После употребления' : 'Конец хода') + ': спасбросок, Сл ' + ongoing.save_dc }}
    </RowActionItem>
    <RowActionSubmenu v-if="effect.data?.weapon_target" label="Оружие для эффекта">
      <template #trigger="{ open }"><RowActionItem :icon="Sword" submenu :submenu-open="open">{{ instance.params?.weapon_uid ? 'Выбранное оружие' : 'Выбрать оружие' }}</RowActionItem></template>
      <template #default="{ close }">
        <RowActionItem v-for="weapon in weapons" :key="weapon.uid" :disabled="!!instance.params?.weapon_uid" @click="chooseWeapon(weapon, close)">
          <template #icon><ItemIcon :item="itemFor(weapon)" :size="28" /></template>{{ weapon.override?.name || itemFor(weapon)?.name || 'Оружие' }}
        </RowActionItem>
        <p v-if="!weapons.length">Добавьте подходящее оружие на вкладку оружия.</p>
      </template>
    </RowActionSubmenu>
  </template>
  <AppModalFrame v-if="result" :title="effect.name" :z-index="3700" @close="result = null"><DiceRollResult :result="result" :size="32" /><p>{{ outcome }}</p></AppModalFrame>
</template>
<script setup>
import { computed, inject, ref, unref } from 'vue'
import { Dices, Sword } from '@lucide/vue'
import { AppModalFrame, RowActionSubmenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import DiceRollResult from '@/shared/ui/DiceRollResult.vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import StatusRepeatSaveMenu from './StatusRepeatSaveMenu.vue'
import { useSuggestStore } from '@/stores/suggest'
import { useDiceStore } from '@/stores/dice'
import { ongoingDamageTransition, statusDamageHp, statusSaveBonus } from '@/features/character-editor/lib/statusMechanics'
const props = defineProps({ context: Object, uid: String, effect: { type: Object, required: true } })
const injected = inject('charCtx', {})
const ctx = computed(() => props.context || injected)
const dice = useDiceStore(), result = ref(null), outcome = ref(''), busy = ref(false)
const suggests = useSuggestStore()
const instance = computed(() => ctx.value.values?.states?.find(row => row.uid === props.uid))
const ongoing = computed(() => props.effect.data?.ongoing_damage)
const phase = computed(() => instance.value?.params?.damage_phase || 'initial_damage')
const damagePhase = computed(() => ['initial_damage', 'turn_damage'].includes(phase.value))
const count = computed(() => Number(instance.value?.params?.damage_dice ?? ongoing.value?.dice_count) || 0)
const itemFor = weapon => unref(ctx.value.characterResources?.itemsById)?.get(String(weapon.item_id))
const weapons = computed(() => (ctx.value.values?.weapon || []).filter(weapon => {
  const types = props.effect.data.weapon_target.damage_types || []
  return !types.length || itemFor(weapon)?.data?.attacks?.some(row => types.includes(Number(row.type)))
}))
function update(params, patch = {}) { ctx.value.updateValues({ ...patch, states: ctx.value.values.states.flatMap(row => row.uid !== props.uid ? [row] : params == null ? [] : [{ ...row, params }]) }) }
function chooseWeapon(weapon, close) { if (instance.value?.params?.weapon_uid) return; update({ ...instance.value.params, weapon_uid: weapon.uid }); close() }
async function runOngoing() {
  if (busy.value || !instance.value || !ongoing.value || !ctx.value.ownerMode) return
  busy.value = true
  try {
    const config = ongoing.value, params = instance.value.params || {}
    if (damagePhase.value) {
      await suggests.ensure(12).catch(() => {})
      if (!instance.value || !ctx.value.ownerMode) return
      const type = suggests.items(12).find(row => Number(row.id) === Number(config.damage_type))
      result.value = dice.roll(props.effect.name, `${count.value}${config.dice}`, { color: type?.color })
      const hp = statusDamageHp(ctx.value.values.hp, result.value.total, unref(ctx.value.characterDefenses?.defenses) || [], config.damage_type)
      update(ongoingDamageTransition(config, params, 'damage'), { hp })
      outcome.value = 'Урон применён с учётом временных хитов и защит. Следующий шаг — спасбросок.'
    } else {
      const context = { kind: 'saving_throw', abilitySuggestId: config.save_ability }
      const mode = ctx.value.characterRolls?.resolve?.('auto', context)?.mode || 'normal'
      result.value = dice.rollD20(props.effect.name, statusSaveBonus(ctx.value, config.save_ability), mode, { bonus_formula: ctx.value.characterDerivedEffects?.rollBonus?.(context) })
      const success = result.value.total >= config.save_dc
      const next = ongoingDamageTransition(config, params, 'save', success)
      update(next)
      outcome.value = !next ? 'Эффект завершён.' : success ? `В следующий ход: ${next.damage_dice}${config.dice}.` : 'Спасбросок не пройден. В следующий ход урон остаётся прежним.'
    }
  } finally { busy.value = false }
}
</script>
