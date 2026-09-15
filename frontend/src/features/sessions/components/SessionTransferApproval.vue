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
        <template #icon><span class="application-target-icon">
          <ItemIcon v-if="target.imageUrl || target.svg" :item="{ iconImageUrl: target.imageUrl, svg: target.svg }" :size="48" />
          <PawPrint v-else-if="target.kind === 'npc'" :size="32" /><UserRound v-else :size="32" />
        </span></template>
        <span class="application-target-details">
          <span class="application-target-name"><NpcMarker v-if="target.kind === 'npc'" :letter="target.letter" :color="target.color" />{{ target.name }}</span>
          <SessionHpBar v-if="target.hp" :hp="target.hp" />
          <span v-else class="application-target-hp-unknown">ХП: —</span>
        </span>
      </ActionButton>
    </div>
    <p v-if="!loadingTargets && !targets.length">Нет доступных целей. Добавьте персонажа в сессию или NPC в бой.</p>
    <p v-if="error" role="alert">{{ error }}</p>
  </AppModalFrame>
</template>
<script setup>
import NpcMarker from './NpcMarker.vue'
import SessionHpBar from './SessionHpBar.vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import TransferDecisionActions from '@/features/item-transfers/components/TransferDecisionActions.vue'
import { notifyApplication } from '@/features/notifications/lib/notifyApplication'
import { computed, inject, ref } from 'vue'
import { PawPrint, UserRound } from '@lucide/vue'
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
.application-targets .application-target { display: grid; grid-template-columns: 48px minmax(0, 1fr); text-align: left; overflow-wrap: anywhere; }
.application-target-icon { display: grid; place-items: center; width: 48px; height: 48px; flex: 0 0 48px; }
.application-target-details { display: grid; gap: 4px; min-width: 0; }
.application-target-name { display: flex; align-items: center; gap: 6px; }
.application-target-hp-unknown { color: var(--text-muted); font-size: 12px; }
.transfer-approval { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.transfer-approval-error { color: var(--danger); font-size: 12px; }
</style>
