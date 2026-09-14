<template>
  <BaseTile v-if="!ctx.ownerMode && ctx.characterUuid" class="read-only-notice" role="status">
    <Eye :size="20" aria-hidden="true" />
    <div><strong>Режим просмотра</strong><p>{{ signedIn ? 'Этот персонаж принадлежит другому игроку. Изменения недоступны.' : 'Вы не авторизованы. Войдите, чтобы редактировать своего персонажа.' }}</p></div>
  </BaseTile>
</template>
<script setup>
import { computed, inject } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import { Eye } from '@lucide/vue'
import { useAccountStore } from '@/stores/account'
const ctx = inject('charCtx', {})
const account = useAccountStore()
const signedIn = computed(() => Boolean(account.user?.id))
</script>
<style scoped>
.read-only-notice { display: flex; align-items: flex-start; gap: 12px; padding: 14px; color: var(--text-2); }
.read-only-notice > svg { flex: 0 0 20px; color: var(--text-muted); }
.read-only-notice strong { color: var(--text-1); font-size: 14px; }
.read-only-notice p { margin: 4px 0 0; font-size: 13px; line-height: 1.45; }
</style>
