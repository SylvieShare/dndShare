<template>
  <div class="attack-targets">
    <div v-if="event.data.attackTargets?.length" class="attack-target-names" aria-label="Цели атаки">
      <Swords class="attack-target-marker" :size="20" aria-hidden="true" />
      <SaveTargetName v-for="target in event.data.attackTargets" :key="impactTargetKey(target)" :target="target" />
    </div>
    <ActionButton v-if="isDm" size="sm" variant="dashed" @click="choose">{{ event.data.attackTargets?.length ? 'Изменить цели' : 'Выбрать цели' }}</ActionButton>
  </div>
  <SessionTargetPicker :event="event" v-if="picking" v-model="selected" title="Цели атаки" :targets="targets" :loading="loading" :busy="busy" :locked="busy || !!pending" :error="error" @close="picking = false">
    <template #footer><ActionButton :disabled="busy || loading || loadFailed" @click="save">{{ pending ? 'Повторить сохранение' : `Сохранить · ${selected.length}` }}</ActionButton></template>
  </SessionTargetPicker>
</template>
<script setup>
import { Swords } from '@lucide/vue'
import { inject, ref } from 'vue'
import { ActionButton } from '@sylvieshare/share-ui'
import { loadSessionTargets } from '../lib/loadSessionTargets'
import { useSuggestStore } from '@/stores/suggest'
import { setSessionAttackTargets } from '@/shared/api/sessionEventsApi'
import { useSessionEventsStore } from '@/stores/sessionEvents'
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
    targets.value = (await loadSessionTargets(events.sessionUuid, useSuggestStore())).targets
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
.attack-targets { display: contents; }
.attack-targets > button { margin-left: auto; }
.attack-target-names { position: relative; order: 2; flex-basis: 100%; display: flex; flex-direction: column; gap: 10px; margin-left: 30px; padding: 4px 0 4px 12px; border-left: 2px solid var(--danger); font-size: 13px; }
.attack-target-marker { position: absolute; left: -30px; top: 8px; color: var(--danger); }
</style>
