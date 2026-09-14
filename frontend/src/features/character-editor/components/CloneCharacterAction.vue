<template>
  <div v-if="ctx.canClone" class="clone-action">
    <ActionButton variant="quiet" :disabled="busy" @click="clone"><template #icon><Copy :size="16" aria-hidden="true" /></template>{{ busy ? 'Клонирование…' : 'Клонировать себе' }}</ActionButton>
    <p v-if="error" role="alert">{{ error }}</p>
  </div>
</template>
<script setup>
import { inject, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ActionButton } from '@sylvieshare/share-ui'
import { Copy } from '@lucide/vue'
import { fetchPost } from '@/shared/api/http'
import { useAccountStore } from '@/stores/account'
const emit = defineEmits(['cloned'])
const ctx = inject('charCtx', {})
const account = useAccountStore()
const router = useRouter()
const busy = ref(false)
const error = ref('')
async function clone() {
  if (busy.value) return
  if (!account.user?.id) {
    window.dispatchEvent(new CustomEvent('dndshare:request-auth', { detail: { reason: 'clone-character' } }))
    return
  }
  busy.value = true
  error.value = ''
  try {
    const result = await fetchPost(`/char/${ctx.characterUuid}/clone`, null)
    account.setHasCharacters(true)
    emit('cloned')
    await router.push({ name: 'Character', params: { uuid: result.uuid } })
  } catch (err) { error.value = err.message || 'Не удалось клонировать персонажа' }
  finally { busy.value = false }
}
</script>
<style scoped>
.clone-action > button { width: 100%; justify-content: flex-start; }
.clone-action p { margin: 4px 8px; color: var(--danger); font-size: 12px; line-height: 1.4; }
</style>
