<template>
  <aside v-if="!ctx.ownerMode && ctx.characterUuid" class="read-only-notice" role="status">
    <Eye :size="16" aria-hidden="true" />
    <div><strong>Режим просмотра</strong><span>{{ signedIn ? 'Персонаж принадлежит другому игроку.' : 'Вы не авторизованы.' }}</span></div>
  </aside>
</template>
<script setup>
import { computed, inject } from 'vue'
import { Eye } from '@lucide/vue'
import { useAccountStore } from '@/stores/account'
const ctx = inject('charCtx', {})
const account = useAccountStore()
const signedIn = computed(() => Boolean(account.user?.id))
</script>
<style scoped>
.read-only-notice {display:flex;align-items:center;gap:var(--spacing-label);padding:4px 0;color:var(--text-muted);font-size:var(--type-context-size)}
.read-only-notice svg {flex:none}
.read-only-notice div {display:flex;flex-wrap:wrap;align-items:baseline;gap:2px var(--spacing-label)}
.read-only-notice strong {color:var(--text-2);font-weight:600}
</style>
