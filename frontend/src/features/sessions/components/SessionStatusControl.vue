<template>
  <div class="session-status-control">
    <button ref="trigger" type="button" class="session-status-trigger" :style="{ color: current.color }"
      :title="`Сессия: ${current.label}`" :aria-label="`Статус сессии: ${current.label}`"
      :aria-expanded="open" :disabled="!isDm || saving" :aria-busy="saving" @click="open = !open">
      <component :is="current.icon" :size="27" />
    </button>
    <BasePopover v-model:open="open" :anchor="trigger" :min-width="210" transition-preset="action-menu">
      <div class="session-status-menu" role="menu" aria-label="Статус сессии">
        <ActionMenuItem v-for="status in statuses" :key="status.key" :icon="status.icon"
          :disabled="saving" :style="{ color: status.color }" @click="select(status.key)">
          {{ status.label }}<template #suffix><Check v-if="status.key === session.status" :size="14" /></template>
        </ActionMenuItem>
        <p v-if="error" class="session-status-error" role="alert">{{ error }}</p>
      </div>
    </BasePopover>
  </div>
</template>
<script setup>
import { computed, ref } from 'vue'
import { Check, CircleCheck, CirclePause, CirclePlay } from '@lucide/vue'
import { ActionMenuItem, BasePopover } from '@sylvieshare/share-ui'
import { updateSessionStatus } from '@/shared/api/sessionsApi'
const props = defineProps({ session: { type: Object, required: true }, isDm: Boolean })
const emit = defineEmits(['updated'])
const statuses = [
  { key: 'active', label: 'Активен', icon: CirclePlay, color: 'var(--success)' },
  { key: 'stopped', label: 'Остановлен', icon: CirclePause, color: 'var(--text-muted)' },
  { key: 'completed', label: 'Завершён', icon: CircleCheck, color: 'var(--accent-soft)' },
]
const current = computed(() => statuses.find(status => status.key === props.session.status) || statuses[1])
const trigger = ref(null)
const open = ref(false)
const saving = ref(false)
const error = ref('')
async function select(status) {
  if (!props.isDm || saving.value) return
  if (status === props.session.status) { open.value = false; return }
  saving.value = true
  error.value = ''
  try {
    await updateSessionStatus(props.session.uuid, status)
    emit('updated', { status })
    open.value = false
  } catch {
    error.value = 'Не удалось изменить статус'
  } finally { saving.value = false }
}
</script>
<style scoped>
.session-status-control { flex: none; }
.session-status-trigger { display: grid; place-items: center; width: 38px; height: 46px; padding: 0; border: 0; background: transparent; cursor: pointer; }
.session-status-trigger:disabled { cursor: default; }
.session-status-trigger:hover:not(:disabled) { filter: brightness(1.2); }
.session-status-menu { padding: 5px; }
.session-status-error { padding: 6px; color: var(--danger); font-size: 12px; }
</style>
