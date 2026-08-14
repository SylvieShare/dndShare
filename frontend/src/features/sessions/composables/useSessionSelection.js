import { ref } from 'vue'
import { kickParticipant as apiKick } from '@/shared/api/sessionsApi'

export function useSessionSelection({ sessionUuid, participants, forgetVersion }) {
  const kickingIds = ref(new Set())
  const kickError = ref('')

  async function kickParticipant(charId) {
    if (kickingIds.value.has(charId)) return false
    kickError.value = ''
    kickingIds.value = new Set([...kickingIds.value, charId])
    try {
      await apiKick(sessionUuid, charId)
      participants.value = participants.value.filter(p => p.charId !== charId)
      forgetVersion?.(charId)
      return true
    } catch {
      kickError.value = 'Не удалось выгнать участника'
      return false
    } finally {
      const next = new Set(kickingIds.value)
      next.delete(charId)
      kickingIds.value = next
    }
  }

  return {
    kickingIds,
    kickError,
    kickParticipant,
  }
}
