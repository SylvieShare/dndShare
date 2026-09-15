<template>
  <span v-if="canApprove" class="transfer-approval">
    <TransferDecisionActions :busy="busy" @accept="event.data?.addressedToDm && event.data?.purpose === 'use' ? chooseTarget() : approve()" @reject="resolve('reject')" />
    <span v-if="error" role="alert" class="transfer-approval-error">{{ error }}</span>
  </span>
  <AppModalFrame v-if="picking" title="К кому применить" :z-index="3700" @close="!busy && (picking = false)">
    <p>Выберите персонажа или конкретное существо. Применение произойдёт сразу после выбора.</p>
    <LoadingIndicator v-if="loadingTargets" label="Загрузка целей" />
    <div class="application-targets">
      <ActionButton v-for="target in targets" :key="target.charUuid || target.npcUid" variant="quiet" class="application-target" :disabled="busy" @click="resolve('accept', target)">
        <template #icon><span class="application-target-icon"><NpcMarker v-if="target.kind === 'npc'" :letter="target.letter" :color="target.color" /><img v-else-if="target.imageUrl" :src="target.imageUrl" alt="" /><UserRound v-else :size="32" /></span></template>
        {{ target.name }}
      </ActionButton>
    </div>
    <p v-if="!loadingTargets && !targets.length">Нет доступных целей. Добавьте персонажа в сессию или NPC в бой.</p>
    <p v-if="error" role="alert">{{ error }}</p>
  </AppModalFrame>
</template>
<script setup>
import NpcMarker from './NpcMarker.vue'
import TransferDecisionActions from '@/features/item-transfers/components/TransferDecisionActions.vue'
import { notifyApplication } from '@/features/notifications/lib/notifyApplication'
import { computed, inject, ref } from 'vue'
import { UserRound } from '@lucide/vue'
import { ActionButton, AppModalFrame, LoadingIndicator } from '@sylvieshare/share-ui'
import { useAccountStore } from '@/stores/account'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { approveSessionTransfer, getApplicationTargets, resolveSessionApplication } from '@/shared/api/itemTransfersApi'
const props = defineProps({ event: { type: Object, required: true } })
const account = useAccountStore()
const events = useSessionEventsStore()
const busy = ref(false)
const error = ref('')
const encounter = inject('applicationEncounter', null)
const picking = ref(false)
const loadingTargets = ref(false)
const targets = ref([])
async function chooseTarget() {
  picking.value = true; loadingTargets.value = true; error.value = ''
  try {
    if (encounter && !await encounter.flushApplicationSave()) throw new Error('Сохраните состояние боя перед применением.')
    targets.value = (await getApplicationTargets(events.sessionUuid)).targets || []
  } catch (cause) { error.value = cause.message }
  finally { loadingTargets.value = false }
}
async function resolve(decision, target = {}) {
  if (busy.value) return
  busy.value = true; error.value = ''
  try {
    if (encounter && !await encounter.flushApplicationSave()) throw new Error('Сохраните состояние боя перед применением.')
    const response = await resolveSessionApplication(events.sessionUuid, props.event.id, decision, target)
    if (decision === 'accept') notifyApplication(response.transfer.itemName, response.transfer.applicationResult)
    picking.value = false
    if (target.kind === 'npc') await encounter?.load()
    await events.refresh()
  } catch (cause) { error.value = cause.message || 'Не удалось применить'; await events.refresh() }
  finally { busy.value = false }
}
const canApprove = computed(() => props.event.data?.status === 'pending' && !!account.user?.id && Number(props.event.sessionOwnerUserId) === Number(account.user.id))
async function approve() {
  if (busy.value || !canApprove.value || !events.sessionUuid) return
  busy.value = true
  error.value = ''
  try {
    const response = await approveSessionTransfer(events.sessionUuid, props.event.id)
    if (props.event.data?.purpose === 'use') notifyApplication(response.transfer.itemName, response.transfer.applicationResult)
    await events.refresh()
  } catch (cause) {
    error.value = cause.message || 'Не удалось принять передачу'
    await events.refresh()
  } finally { busy.value = false }
}
</script>
<style scoped>
.application-targets { display: flex; flex-direction: column; gap: 4px; }
.application-target { justify-content: flex-start; text-align: left; overflow-wrap: anywhere; }
.application-target-icon { display: grid; place-items: center; width: 48px; height: 48px; flex: 0 0 48px; }
.application-target-icon img { width: 100%; height: 100%; object-fit: contain; }
.transfer-approval { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.transfer-approval-error { color: var(--danger); font-size: 12px; }
</style>
