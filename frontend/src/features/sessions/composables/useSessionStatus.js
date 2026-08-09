import { computed, ref } from 'vue'
import { updateSessionStatus } from '@/shared/api/sessionsApi'

export const STATUS_CFG = {
  live:      { label: 'Идёт игра',    color: 'var(--danger)' },
  active:    { label: 'Активна',      color: 'var(--success)' },
  planned:   { label: 'Запланирована', color: 'var(--info)' },
  paused:    { label: 'Пауза',        color: 'var(--warning)' },
  completed: { label: 'Завершена',    color: 'var(--text-muted)' },
  draft:     { label: 'Черновик',     color: 'var(--text-muted)' },
  archived:  { label: 'Архив',        color: 'var(--text-muted)' },
}

const FALLBACK_STATUS = { label: '', color: 'var(--text-muted)' }

export function sessionStatusConfig(status) {
  return STATUS_CFG[status] ?? { ...FALLBACK_STATUS, label: status ?? '' }
}

export function sessionStatusColor(status) {
  return sessionStatusConfig(status).color
}

export function sessionStatusLabel(status) {
  return sessionStatusConfig(status).label
}

export const STATUS_OPTIONS = [
  { key: 'active',    label: 'Активна' },
  { key: 'paused',    label: 'Пауза' },
  { key: 'completed', label: 'Завершено' },
  { key: 'draft',     label: 'Черновик' },
]

export function useSessionStatus({ session, sessionUuid }) {
  const statusOpen = ref(false)

  const statusCfg = computed(() => sessionStatusConfig(session.value?.status))

  async function setStatus(key) {
    statusOpen.value = false
    if (!session.value || session.value.status === key) return
    session.value = { ...session.value, status: key }
    await updateSessionStatus(sessionUuid, key).catch(() => {})
  }

  return {
    statusOpen,
    statusCfg,
    setStatus,
  }
}
