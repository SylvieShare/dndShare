<template>
  <SessionTargetPicker title="Применить результат" v-model="selected" :targets="targets" :loading="loading" :busy="busy" :locked="locked" :fixed="!!target" :disabled-keys="appliedKeys" :error="error" @close="$emit('close')">
    <template #before>
      <DiceRollResult v-if="event.data?.result" :result="event.data.result" :color="event.data.color" :size="28" />
      <p v-if="outcome" class="impact-hint">{{ outcome === 'failure' ? 'Провал: полный урон и выбранный эффект.' : event.data?.savingThrow?.onSuccess === 'half' ? 'Успех: половина урона, без эффекта.' : 'Успех: без урона и эффекта.' }}</p>
      <div v-if="effects.length && outcome !== 'success'" class="impact-effects">
        <strong>Наложить эффект</strong>
        <label v-if="event.data?.damageRoll"><input v-model="effectKey" type="radio" value="" :disabled="locked" /> Только урон</label>
        <label v-for="effect in effects" :key="effect.key"><input v-model="effectKey" type="radio" :value="effect.key" :disabled="locked" /> {{ effect.title }}</label>
        <label v-if="condition" class="impact-condition"><input v-model="conditionConfirmed" type="checkbox" :disabled="locked" /> {{ condition }}</label>
      </div>
      <p v-if="!loading && !event.data?.damageRoll && !effects.length && outcome !== 'success'" class="impact-hint">У этого источника пока не настроено применение эффекта.</p>
    </template>
    <template #target-note="{ target: candidate }">
      <span v-if="impactForTarget(event, candidate)">Уже применено</span>
      <span v-else-if="!outcome && impactOutcome(event, candidate)">{{ impactOutcome(event, candidate) === 'success' ? 'Успех' : 'Провал' }}</span>
    </template>
    <p class="impact-hint">Урон сначала поглощают временные хиты. Защиты учитываются, если они настроены в механиках.</p>
    <template #footer><ActionButton :disabled="busy || loading || !selected.length || (!event.data?.damageRoll && !effectKey && outcome !== 'success') || (!!condition && !conditionConfirmed)" @click="apply">{{ pending ? 'Повторить применение' : `Применить · ${selected.length}` }}</ActionButton></template>
  </SessionTargetPicker>
</template>
<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { ActionButton } from '@sylvieshare/share-ui'
import { getApplicationTargets } from '@/shared/api/itemTransfersApi'
import { applySessionImpact } from '@/shared/api/sessionEventsApi'
import { itemsApi } from '@/shared/api/itemsApi'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import DiceRollResult from '@/shared/ui/DiceRollResult.vue'
import SessionTargetPicker from './SessionTargetPicker.vue'
import { impactTargetKey, impactOutcome, impactForTarget, targetIdentity } from '../lib/sessionImpact'
const props = defineProps({ event: Object, target: Object, outcome: String })
const emit = defineEmits(['close'])
const events = useSessionEventsStore(), encounter = inject('applicationEncounter', null)
const loading = ref(true), busy = ref(false), error = ref(''), pending = ref(null)
const targets = ref([]), selected = ref([]), effects = ref([]), effectKey = ref(''), conditionConfirmed = ref(false)
const appliedKeys = computed(() => (props.event.data?.impacts || []).map(row => row.key))
const locked = computed(() => busy.value || !!pending.value)
const condition = computed(() => props.outcome !== 'success' && effects.value.find(row => row.key === effectKey.value)?.condition || '')
onMounted(async () => {
  try {
    if (encounter && !await encounter.flushApplicationSave()) throw new Error('Сохраните состояние боя перед применением.')
    const available = (await getApplicationTargets(events.sessionUuid)).targets || []
    targets.value = props.target ? available.filter(target => impactTargetKey(target) === impactTargetKey(props.target)) : available
    if (props.target) {
      if (!targets.value.length) throw new Error('Цель больше не доступна в сессии.')
      selected.value = [impactTargetKey(props.target)]
    }
    const sourceId = props.event.data?.source?.itemId
    if (sourceId) {
      const source = (await itemsApi.byIds([sourceId])).items?.[0]
      effects.value = (source?.data?.status_effects || []).filter(row => row.key && row.effect?.id).map(row => ({ ...row, title: row.title || row.effect.name || `Эффект #${row.effect.id}` }))
      if (effects.value.length) {
        const names = new Map(((await itemsApi.byIds(effects.value.map(row => row.effect.id))).items || []).map(item => [String(item.id), item.name]))
        effects.value = effects.value.map(row => ({ ...row, title: names.get(String(row.effect.id)) || row.title }))
        if (!props.event.data?.damageRoll) effectKey.value = effects.value[0].key
      }
    }
  } catch (cause) { error.value = cause.message }
  finally { loading.value = false }
})
async function apply() {
  if (busy.value) return
  busy.value = true; error.value = ''
  try {
    pending.value ||= { eventId: props.event.id, clientActionId: crypto.randomUUID(), effectKey: effectKey.value, targets: targets.value.filter(row => selected.value.includes(impactTargetKey(row))).map(target => ({ target: targetIdentity(target), outcome: props.outcome || impactOutcome(props.event, target) })) }
    await applySessionImpact(events.sessionUuid, pending.value)
    // A committed request remains retryable if refreshing the view fails.
    await events.refresh()
    if (encounter) await encounter.load()
    emit('close')
  } catch (cause) { error.value = cause.message || 'Не удалось применить результат. Повтор не спишет хиты дважды.' }
  finally { busy.value = false }
}
</script>
<style scoped>
.impact-effects { display: grid; gap: 10px; }
.impact-effects label { display: flex; align-items: center; gap: 8px; }
.impact-condition { color: var(--warning); }
.impact-hint { margin: 0; font-size: 12px; color: var(--text-muted); }
input { accent-color: var(--accent); }
</style>
