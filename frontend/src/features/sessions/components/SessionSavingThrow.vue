<template>
  <section class="event-save" aria-label="Спасбросок заклинания">
    <header><Shield :size="18" /><strong>{{ SAVE_ABILITIES[save.ability - 1] }} · Сл {{ save.dc }}</strong>
      <ActionButton v-if="isDm" size="sm" variant="dashed" :disabled="busy" @click="choose">Бросить</ActionButton>
    </header>
    <small v-if="save.onSuccess === 'half'">При успехе — половина урона</small>
    <small v-if="save.condition">{{ save.condition }}</small>
    <div v-for="row in save.results || []" :key="row.key" class="event-save-result">
      <SaveTargetName :target="row.target" />
      <DiceRollResult :result="row.result" :size="24" />
      <DamageImpact v-if="impactForTarget(event, row.target)" class="save-impact" :impact="impactForTarget(event, row.target)" :show-target="false" />
      <div v-else-if="isDm" class="save-apply">
        <ActionButton size="sm" :variant="row.success ? 'primary' : 'quiet'" @click="applying = { target: row.target, outcome: 'success' }">Применить успех</ActionButton>
        <ActionButton size="sm" :variant="!row.success ? 'primary' : 'quiet'" @click="applying = { target: row.target, outcome: 'failure' }">Применить провал</ActionButton>
      </div>
      <span v-else :class="row.success ? 'save-success' : 'save-failure'">{{ row.success ? 'Успех' : 'Провал' }}</span>
    </div>
  </section>
  <SessionImpactModal v-if="applying" :event="event" v-bind="applying" @close="applying = null" />
  <SessionTargetPicker :event="event" v-if="picking" v-model="selected" :title="`${SAVE_ABILITIES[save.ability - 1]} · Сл ${save.dc}`" :targets="targets" :loading="loading" :busy="busy" :locked="busy || !!pending" :disabled-keys="[...rolled]" :error="error" :z-index="3700" @close="picking = false">
    <template #target-note="{ target }"><span v-if="rolled.has(saveTargetKey(target))">Уже брошено</span><SaveFormulaPreview v-else :profile="profile(target)" /></template>
    <RollModeControl v-if="!pending" v-model="mode" label="Режим спасбросков" />
    <template #footer><ActionButton :disabled="busy || loading || !selected.length" @click="rollSelected">{{ pending ? 'Сохранить результаты' : `Бросить · ${selected.length}` }}</ActionButton></template>
  </SessionTargetPicker>
</template>
<script setup>
import { computed, defineAsyncComponent, inject, ref } from 'vue'
import { Shield } from '@lucide/vue'
import { ActionButton } from '@sylvieshare/share-ui'
import SaveTargetName from './SaveTargetName.vue'
import SessionTargetPicker from './SessionTargetPicker.vue'
import DiceRollResult from '@/shared/ui/DiceRollResult.vue'
import { loadSessionTargets } from '../lib/loadSessionTargets'
import SaveFormulaPreview from './SaveFormulaPreview.vue'
import RollModeControl from '@/features/character-editor/blocks/dnd/components/RollModeControl.vue'
import { useAccountStore } from '@/stores/account'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { useSuggestStore } from '@/stores/suggest'
import { useDiceStore } from '@/stores/dice'
import { appendSessionSaves } from '@/shared/api/sessionEventsApi'
import { impactForTarget } from '../lib/sessionImpact'
import { SAVE_ABILITIES, saveTargetKey, sessionSaveProfile } from '../lib/sessionSaveRoll'
const SessionImpactModal = defineAsyncComponent(() => import('./SessionImpactModal.vue'))
const DamageImpact = defineAsyncComponent(() => import('./DamageImpact.vue'))
const applying = ref(null)
const props = defineProps({ event: { type: Object, required: true } })
const account = useAccountStore(), events = useSessionEventsStore(), dice = useDiceStore()
const suggest = useSuggestStore()
const encounter = inject('applicationEncounter', null)
const save = computed(() => props.event.data.savingThrow)
const isDm = computed(() => Number(account.user?.id) === Number(props.event.sessionOwnerUserId))
const rolled = computed(() => new Set((save.value.results || []).map(row => row.key)))
const picking = ref(false), loading = ref(false), busy = ref(false), error = ref(''), mode = ref('auto')
const targets = ref([]), selected = ref([]), pending = ref(null)
let items = new Map()
function profile(target) { return sessionSaveProfile(target, save.value.ability, items, mode.value, type => suggest.items(type)) }
async function choose() {
  picking.value = true
  if (pending.value) { selected.value = pending.value.map(row => saveTargetKey(row.target)); return }
  loading.value = true; error.value = ''; selected.value = []
  try {
    if (encounter && !await encounter.flushApplicationSave()) throw new Error('Сохраните состояние боя перед броском.')
    const loaded = await loadSessionTargets(events.sessionUuid, suggest)
    items = loaded.items; targets.value = loaded.targets
  } catch (cause) { targets.value = []; error.value = cause.message }
  finally { loading.value = false }
}
async function rollSelected() {
  if (busy.value) return
  busy.value = true; error.value = ''
  try {
    if (!pending.value) pending.value = targets.value.filter(target => selected.value.includes(saveTargetKey(target))).map(target => {
      const profile = sessionSaveProfile(target, save.value.ability, items, mode.value, type => suggest.items(type))
      const result = dice.rollD20('Спасбросок', profile.bonus, profile.mode, { bonus_formula: profile.formula, popup: false, log: false })
      const { snapshot, hp, armorClass, ...identity } = target
      return { target: identity, result }
    })
    await appendSessionSaves(events.sessionUuid, props.event.id, pending.value)
    pending.value = null; picking.value = false
    await events.refresh()
  } catch (cause) { error.value = cause.message || 'Не удалось сохранить спасброски. Повтор сохранит те же результаты.' }
  finally { busy.value = false }
}
</script>
<style scoped>
.save-apply { display: flex; flex-wrap: wrap; gap: 6px; }.save-impact { width: 100%; }
.event-save { border: 1px solid var(--border); border-radius: var(--r-sm); padding: 10px; display: grid; gap: 8px; }
.event-save header { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 13px; }
.event-save header button { margin-left: auto; }
.event-save small { color: var(--text-muted); }
.event-save-result { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; border-top: 1px solid var(--border); padding-top: 8px; font-size: 12px; }
.event-save-result > :first-child { flex: 1; }
.save-success { color: var(--success); }.save-failure { color: var(--danger); }
</style>
