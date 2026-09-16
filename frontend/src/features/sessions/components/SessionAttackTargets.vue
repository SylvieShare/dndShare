<template>
  <div class="attack-targets">
    <div v-if="event.data.attackTargets?.length" class="attack-target-names" aria-label="Цели атаки">
      <SaveTargetName v-for="target in event.data.attackTargets" :key="impactTargetKey(target)" :target="target" />
    </div>
    <ActionButton v-if="isDm" size="sm" variant="quiet" @click="choose">{{ event.data.attackTargets?.length ? 'Изменить цели' : 'Выбрать цели' }}</ActionButton>
  </div>
  <SessionTargetPicker v-if="picking" v-model="selected" title="Цели атаки" :targets="targets" :loading="loading" :busy="busy" :locked="busy || !!pending" :error="error" @close="picking = false">
    <template #before><DiceRollResult :result="event.data.result" :color="event.data.color" :size="28" /></template>
    <template #footer><ActionButton :disabled="busy || loading || loadFailed" @click="save">{{ pending ? 'Повторить сохранение' : `Сохранить · ${selected.length}` }}</ActionButton></template>
  </SessionTargetPicker>
</template>
<script setup>
import { inject, ref } from 'vue'
import { ActionButton } from '@sylvieshare/share-ui'
import { getApplicationTargets } from '@/shared/api/itemTransfersApi'
import { setSessionAttackTargets } from '@/shared/api/sessionEventsApi'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import DiceRollResult from '@/shared/ui/DiceRollResult.vue'
import SaveTargetName from './SaveTargetName.vue'
import SessionTargetPicker from './SessionTargetPicker.vue'
import { impactTargetKey, targetIdentity } from '../lib/sessionImpact'
const props = defineProps({ event: { type: Object, required: true }, isDm: Boolean })
const events = useSessionEventsStore(), encounter = inject('applicationEncounter', null)
const picking = ref(false), loading = ref(false), busy = ref(false), loadFailed = ref(false), error = ref('')
const targets = ref([]), selected = ref([]), pending = ref(null)
async function choose() {
  picking.value = true
  if (pending.value) return
  loading.value = true; error.value = ''; loadFailed.value = false
  try {
    if (encounter && !await encounter.flushApplicationSave()) throw new Error('Сохраните состояние боя перед выбором целей.')
    targets.value = (await getApplicationTargets(events.sessionUuid)).targets || []
    const previous = new Set((props.event.data.attackTargets || []).map(impactTargetKey))
    selected.value = targets.value.map(impactTargetKey).filter(key => previous.has(key))
  } catch (cause) { loadFailed.value = true; error.value = cause.message }
  finally { loading.value = false }
}
async function save() {
  if (busy.value || loading.value || loadFailed.value) return
  busy.value = true; error.value = ''
  try {
    pending.value ||= targets.value.filter(target => selected.value.includes(impactTargetKey(target))).map(targetIdentity)
    await setSessionAttackTargets(events.sessionUuid, props.event.id, pending.value)
    await events.refresh()
    pending.value = null; picking.value = false
  } catch (cause) { error.value = cause.message || 'Не удалось сохранить цели атаки.' }
  finally { busy.value = false }
}
</script>
<style scoped>
.attack-targets { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.attack-targets > button { margin-left: auto; }
.attack-target-names { display: flex; flex-wrap: wrap; gap: 10px; font-size: 13px; }
</style>
