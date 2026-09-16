<template>
  <AppModalFrame title="Применить результат" :z-index="3800" @close="!busy && $emit('close')">
    <div class="impact-form">
      <DiceRollResult v-if="event.data?.result" :result="event.data.result" :color="event.data.color" :size="28" />
      <p v-if="outcome" class="impact-hint">{{ outcome === 'failure' ? 'Провал: полный урон и выбранный эффект.' : event.data?.savingThrow?.onSuccess === 'half' ? 'Успех: половина урона, без эффекта.' : 'Успех: без урона и эффекта.' }}</p>
      <LoadingIndicator v-if="loading" label="Загрузка целей" />
      <div v-if="effects.length && outcome !== 'success'" class="impact-effects">
        <strong>Наложить эффект</strong>
        <label v-if="event.data?.damageRoll"><input v-model="effectKey" type="radio" value="" :disabled="locked" /> Только урон</label>
        <label v-for="effect in effects" :key="effect.key"><input v-model="effectKey" type="radio" :value="effect.key" :disabled="locked" /> {{ effect.title }}</label>
        <label v-if="condition" class="impact-condition"><input v-model="conditionConfirmed" type="checkbox" :disabled="locked" /> {{ condition }}</label>
      </div>
      <p v-if="!loading && !event.data?.damageRoll && !effects.length && outcome !== 'success'" class="impact-hint">У этого источника пока не настроено применение эффекта.</p>
      <div class="impact-targets">
        <label v-for="candidate in targets" :key="impactTargetKey(candidate)" class="impact-target">
          <input v-if="!target" v-model="selected" type="checkbox" :value="impactTargetKey(candidate)" :disabled="locked || !!impactForTarget(event, candidate)" />
          <SaveTargetName :target="candidate" />
          <small v-if="impactForTarget(event, candidate)">Уже применено</small>
          <small v-else-if="!outcome && impactOutcome(event, candidate)">{{ impactOutcome(event, candidate) === 'success' ? 'Успех' : 'Провал' }}</small>
        </label>
      </div>
      <p class="impact-hint">Урон сначала поглощают временные хиты. Защиты учитываются, если они настроены в механиках.</p>
      <p v-if="error" class="impact-error" role="alert">{{ error }}</p>
    </div>
    <template #footer><ActionButton :disabled="busy || loading || !selected.length || (!event.data?.damageRoll && !effectKey && outcome !== 'success') || (!!condition && !conditionConfirmed)" @click="apply">{{ pending ? 'Повторить применение' : `Применить · ${selected.length}` }}</ActionButton></template>
  </AppModalFrame>
</template>
<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { ActionButton, AppModalFrame, LoadingIndicator } from '@sylvieshare/share-ui'
import { getSaveTargets, applySessionImpact } from '@/shared/api/sessionEventsApi'
import { itemsApi } from '@/shared/api/itemsApi'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import DiceRollResult from '@/shared/ui/DiceRollResult.vue'
import SaveTargetName from './SaveTargetName.vue'
import { impactTargetKey, impactOutcome, impactForTarget, targetIdentity } from '../lib/sessionImpact'
const props = defineProps({ event: Object, target: Object, outcome: String })
const emit = defineEmits(['close'])
const events = useSessionEventsStore(), encounter = inject('applicationEncounter', null)
const loading = ref(true), busy = ref(false), error = ref(''), pending = ref(null)
const targets = ref([]), selected = ref([]), effects = ref([]), effectKey = ref(''), conditionConfirmed = ref(false)
const locked = computed(() => busy.value || !!pending.value)
const condition = computed(() => props.outcome !== 'success' && effects.value.find(row => row.key === effectKey.value)?.condition || '')
onMounted(async () => {
  try {
    if (encounter && !await encounter.flushApplicationSave()) throw new Error('Сохраните состояние боя перед применением.')
    targets.value = props.target ? [props.target] : (await getSaveTargets(events.sessionUuid)).targets || []
    if (props.target) selected.value = [impactTargetKey(props.target)]
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
.impact-form, .impact-effects, .impact-targets { display: grid; gap: 10px; }
.impact-targets { max-height: 45vh; overflow: auto; }
.impact-target { display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid var(--border); border-radius: var(--r-sm); cursor: pointer; }.impact-target > :nth-child(2) { flex: 1; }
.impact-effects label { display: flex; align-items: center; gap: 8px; }.impact-condition { color: var(--warning); }
.impact-hint, .impact-target small { margin: 0; font-size: 12px; color: var(--text-muted); }.impact-error { color: var(--danger); }
input { accent-color: var(--accent); }
</style>
