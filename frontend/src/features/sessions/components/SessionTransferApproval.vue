<template>
  <span v-if="canApprove" class="transfer-approval">
    <ActionButton :loading="busy" loading-label="Принимаем передачу" @click="approve"><template #icon><Check :size="15" /></template>{{ busy ? 'Принимаем…' : 'Принять передачу' }}</ActionButton>
    <span v-if="error" role="alert" class="transfer-approval-error">{{ error }}</span>
  </span>
</template>
<script setup>
import { computed, ref } from 'vue'
import { Check } from '@lucide/vue'
import { ActionButton } from '@sylvieshare/share-ui'
import { useAccountStore } from '@/stores/account'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { approveSessionTransfer } from '@/shared/api/itemTransfersApi'
const props = defineProps({ event: { type: Object, required: true } })
const account = useAccountStore()
const events = useSessionEventsStore()
const busy = ref(false)
const error = ref('')
const canApprove = computed(() => props.event.data?.status === 'pending' && !!account.user?.id && Number(props.event.sessionOwnerUserId) === Number(account.user.id))
async function approve() {
  if (busy.value || !canApprove.value || !events.sessionUuid) return
  busy.value = true
  error.value = ''
  try {
    await approveSessionTransfer(events.sessionUuid, props.event.id)
    await events.refresh()
  } catch (cause) {
    error.value = cause.message || 'Не удалось принять передачу'
    await events.refresh()
  } finally { busy.value = false }
}
</script>
<style scoped>
.transfer-approval { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.transfer-approval-error { color: var(--danger); font-size: 12px; }
</style>
