<template>
  <div class="roll-sequence">
    <span v-if="sequence.jumpLimit" class="sequence-note">Перескоки: {{ sequence.hits.filter(hit => hit.jump).length }}/{{ sequence.jumpLimit }}</span>
    <div v-for="(hit, index) in sequence.hits" :key="index" class="sequence-hit">
      <SaveTargetName v-if="hit.target" :target="hit.target" />
      <DiceRollResult v-if="index && hit.attack" :result="hit.attack" :size="28" />
      <span v-if="hit.status === 'miss'" class="sequence-note">Промах</span>
      <DiceRollResult v-if="hit.result" :result="hit.result" :size="28" />
      <div v-if="hit.status === 'choice'" class="sequence-choices">
        <span>Тип урона:</span>
        <ActionButton v-for="choice in hit.choices" :key="choice.id" size="sm" :disabled="!canChoose || busy || !!pending" variant="secondary" @click="send('type', { typeId: choice.id })">
          <SystemDie :sides="sequence.table.sides" :value="choice.value" :size="24" :color="type(choice.id)?.color" />
          <SvgIcon v-if="type(choice.id)?.svg" :svg="type(choice.id).svg" :color="type(choice.id).color" :size="18" />
          {{ type(choice.id)?.value || `Тип ${choice.id}` }}
        </ActionButton>
      </div>
      <span v-if="hit.damageType" class="sequence-type" :style="{ color: hit.damageType.color }">{{ hit.damageType.label }}</span>
      <ActionButton v-if="isDm && hit.damageRoll && !hit.impacts?.length" size="sm" variant="dashed" @click="impactIndex = index">Применить к цели</ActionButton>
      <DamageImpact v-for="impact in hit.impacts || []" :key="impact.key" :impact="impact" />
    </div>
    <template v-if="!sequence.finished">
      <div v-if="isDm" class="sequence-controls">
        <ActionButton v-if="current.status === 'target'" size="sm" variant="dashed" :disabled="locked" @click="choose">Выбрать цель</ActionButton>
        <template v-if="current.status === 'attack'">
          <ToggleSwitch v-model="critical" label="Критическое попадание" :disabled="locked" />
          <ActionButton size="sm" variant="dashed" :disabled="locked" @click="send('hit', { critical })">Попадание · бросить урон</ActionButton>
          <ActionButton size="sm" variant="secondary" :disabled="locked" @click="send('miss')">Промах</ActionButton>
        </template>
        <template v-if="['ready', 'miss'].includes(current.status)">
          <ActionButton v-if="current.canContinue" size="sm" variant="dashed" :disabled="locked" @click="send('next')">Перескочить на…</ActionButton>
          <ActionButton v-if="(sequence.projectile || 1) < sequence.instances" size="sm" variant="dashed" :disabled="locked" @click="send('projectile')">Следующий снаряд · {{ (sequence.projectile || 1) + 1 }}/{{ sequence.instances }}</ActionButton>
        </template>
        <ActionButton size="sm" variant="ghost" :disabled="locked" @click="send('finish')">Завершить</ActionButton>
      </div>
      <p v-else-if="current.status !== 'choice'" class="sequence-note">Мастер выбирает цель и подтверждает попадание в хронике.</p>
    </template>
    <p v-else class="sequence-note">Сотворение завершено</p>
    <div v-if="error" role="alert" class="sequence-error">{{ error }} <ActionButton v-if="pending" size="sm" :disabled="busy" @click="retry">Повторить</ActionButton></div>
  </div>
  <SessionTargetPicker v-if="picking" :event="event" title="Цель снаряда" :model-value="selected" @update:model-value="selected = $event.slice(-1)" :targets="targets" :disabled-keys="usedKeys" :loading="loading" :busy="busy" :locked="locked" :error="error" @close="picking = false">
    <template #before><p v-if="(current.jump ? sequence.chain?.distance : sequence.range)" class="sequence-note">{{ current.jump ? sequence.chain.distance : sequence.range }} фт. {{ sequence.chain?.origin === 'previous' && current.jump ? 'от предыдущей цели' : 'от заклинателя' }} · расстояние проверяет мастер</p>
      <div v-if="!current.attack" class="sequence-controls"><ToggleSwitch :model-value="mode === 'advantage'" label="Преимущество" :disabled="mode === 'disadvantage'" @update:model-value="mode = $event ? 'advantage' : 'normal'" /><ToggleSwitch :model-value="mode === 'disadvantage'" label="Помеха" :disabled="mode === 'advantage'" @update:model-value="mode = $event ? 'disadvantage' : 'normal'" /></div>
    </template>
    <template #footer><ActionButton :disabled="locked || loading || !selected.length" @click="selectTarget">{{ current.attack ? 'Выбрать цель' : 'Выбрать и бросить атаку' }}</ActionButton></template>
  </SessionTargetPicker>
  <SessionImpactModal v-if="impactIndex !== null" :event="impactEvent" :target="sequence.hits[impactIndex].target" @close="impactIndex = null" />
</template>
<script setup>
import { computed, defineAsyncComponent, inject, ref, watch } from 'vue'
import { ActionButton, ToggleSwitch } from '@sylvieshare/share-ui'
import { useSuggestStore } from '@/stores/suggest'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { useAccountStore } from '@/stores/account'
import { advanceSessionSequence } from '@/shared/api/sessionEventsApi'
import { loadSessionTargets } from '../lib/loadSessionTargets'
import { impactTargetKey, targetIdentity } from '../lib/sessionImpact'
import DiceRollResult from '@/shared/ui/DiceRollResult.vue'
import SystemDie from '@/shared/ui/SystemDie.vue'
import SvgIcon from '@/shared/ui/SvgIcon.vue'
import SaveTargetName from './SaveTargetName.vue'
import SessionTargetPicker from './SessionTargetPicker.vue'
const DamageImpact = defineAsyncComponent(() => import('./DamageImpact.vue'))
const SessionImpactModal = defineAsyncComponent(() => import('./SessionImpactModal.vue'))
const props = defineProps({ event: Object, isDm: Boolean })
const events = useSessionEventsStore(), suggests = useSuggestStore(), account = useAccountStore(), encounter = inject('applicationEncounter', null)
suggests.ensure(12)
const sequence = computed(() => props.event.data.sequence), current = computed(() => sequence.value.hits.at(-1))
const type = id => suggests.items(12).find(row => Number(row.id) === Number(id))
const canChoose = computed(() => props.isDm || Number(props.event.authorUserId) === Number(account.user?.id))
const busy = ref(false), error = ref(''), pending = ref(null), picking = ref(false), loading = ref(false), targets = ref([]), selected = ref([]), mode = ref('normal'), critical = ref(false), impactIndex = ref(null)
const locked = computed(() => busy.value || !!pending.value)
watch(() => current.value.attack, attack => { const part = attack?.parts?.find(p => p.sides === 20); critical.value = part?.rolls?.[part.keptIndex ?? 0] === 20 }, { immediate: true })
const usedKeys = computed(() => sequence.value.chain?.unique === 'none' ? [] : sequence.value.hits.slice(0, -1).filter(hit => sequence.value.chain?.unique !== 'hit' || hit.status === 'ready').map(hit => hit.target?.key).filter(Boolean))
const impactEvent = computed(() => ({ ...props.event, data: { ...props.event.data, ...sequence.value.hits[impactIndex.value], sequenceIndex: impactIndex.value, attackRoll: false, sequence: undefined } }))
async function send(action, fields = {}) {
  if (locked.value) return
  pending.value = { action, ...fields, clientActionId: crypto.randomUUID(), revision: sequence.value.revision || 0 }
  await retry()
}
async function retry() {
  if (busy.value || !pending.value) return
  busy.value = true; error.value = ''
  try { await advanceSessionSequence(events.sessionUuid, props.event.id, pending.value); await events.refresh(); pending.value = null; picking.value = false }
  catch (cause) { error.value = cause.message || 'Не удалось сохранить шаг. Повтор не перебросит кубики.'; if (cause.status >= 400 && cause.status < 500) { pending.value = null; await events.refresh() } }
  finally { busy.value = false }
}
async function choose() {
  picking.value = true; loading.value = true; error.value = ''; selected.value = []; mode.value = 'normal'
  try {
    if (encounter && !await encounter.flushApplicationSave()) throw new Error('Сохраните состояние боя перед выбором цели.')
    targets.value = (await loadSessionTargets(events.sessionUuid, suggests)).targets
  } catch (cause) { error.value = cause.message }
  finally { loading.value = false }
}
function selectTarget() {
  const target = targets.value.find(target => impactTargetKey(target) === selected.value[0])
  if (target) send('target', { target: targetIdentity(target), mode: mode.value })
}
</script>
<style scoped>
.roll-sequence { display: grid; gap: 12px; min-width: 0; }
.sequence-hit { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; padding: 8px 0 8px 12px; border-left: 2px solid var(--danger); }
.sequence-hit > .save-target-name { flex-basis: 100%; }.sequence-hit > button { margin-left: auto; }
.sequence-choices, .sequence-controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.sequence-choices { flex-basis: 100%; }.sequence-choices > button { gap: 6px; }
.sequence-note { margin: 0; color: var(--text-muted); font-size: 12px; }.sequence-type { font-size: 12px; }.sequence-error { color: var(--danger); font-size: 12px; }
</style>
