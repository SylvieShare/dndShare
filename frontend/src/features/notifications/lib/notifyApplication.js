import { useNotificationsStore } from '@/stores/notifications'

export function notifyApplication(name, result) {
  if (!result) return
  return useNotificationsStore().notify({
    type: 'application', title: `Применено: ${name || 'Предмет'}`,
    data: { result }, duration: 10000,
  })
}
