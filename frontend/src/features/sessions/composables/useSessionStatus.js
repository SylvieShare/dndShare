import { computed, ref } from 'vue'
import { updateSessionStatus } from '@/shared/api/sessionsApi'

export const STATUS_CFG = {
  live:      { label: 'Идёт игра',     color: '#e85c5c' },
  active:    { label: 'Активно',        color: '#5ce87c' },
  planned:   { label: 'Запланировано',  color: '#5c95e8' },
  paused:    { label: 'Пауза',          color: '#e89c3c' },
  completed: { label: 'Завершено',      color: '#707080' },
  draft:     { label: 'Черновик',       color: '#505060' },
  archived:  { label: 'Архив',          color: '#505060' },
}

export const STATUS_OPTIONS = [
  { key: 'active',    label: 'Активна' },
  { key: 'paused',    label: 'Пауза' },
  { key: 'completed', label: 'Завершено' },
  { key: 'draft',     label: 'Черновик' },
]

export function useSessionStatus({ session, sessionUuid }) {
  const statusOpen = ref(false)

  const statusCfg = computed(() =>
    STATUS_CFG[session.value?.status] ?? { label: session.value?.status ?? '', color: '#505060' }
  )

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
