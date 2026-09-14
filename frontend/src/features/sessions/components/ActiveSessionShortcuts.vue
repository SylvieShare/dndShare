<template>
  <nav v-if="store.sessions.length" class="active-session-shortcuts" :class="{ 'active-session-shortcuts--mobile': mobile }" aria-label="Активные сессии">
    <SidebarNavItem v-for="session in store.sessions" :key="session.uuid" :as="RouterLink"
      class="active-session-shortcut" :to="`/sessions/${session.uuid}`" :icon="CirclePlay"
      :label="session.name" :title="`Активная сессия: ${session.name}`" :aria-label="`Активная сессия: ${session.name}`"
      :active="route.params.uuid === session.uuid" />
  </nav>
</template>
<script setup>
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { CirclePlay } from '@lucide/vue'
import { SidebarNavItem } from '@sylvieshare/share-ui'
import { useAccountStore } from '@/stores/account'
import { useActiveSessionsStore } from '@/stores/activeSessions'
defineProps({ mobile: Boolean })
const route = useRoute()
const account = useAccountStore()
const store = useActiveSessionsStore()
watch(() => account.authStatus === 'success' ? account.user?.id : null, id => {
  store.setUser(id)
  store.refresh()
}, { immediate: true })
watch(() => route.fullPath, () => store.refresh())
const refreshOnFocus = () => store.refresh(true)
onMounted(() => window.addEventListener('focus', refreshOnFocus))
onBeforeUnmount(() => window.removeEventListener('focus', refreshOnFocus))
</script>
<style scoped>
.active-session-shortcuts { display: grid; gap: 6px; min-width: 0; margin-block: 6px; }
.active-session-shortcuts .active-session-shortcut { border: 1px dashed var(--accent); color: var(--accent-soft); }
.active-session-shortcuts--mobile { display: flex; flex: 0 1 auto; min-width: 36px; overflow-x: auto; }
.active-session-shortcuts--mobile .active-session-shortcut { min-width: 36px; width: auto; max-width: 160px; height: 34px; }
.active-session-shortcuts--mobile :deep(.share-sidebar-icon) { width: 34px; flex-basis: 34px; }
.active-session-shortcuts--mobile :deep(.share-sidebar-label) { opacity: 1; transform: none; font-size: 11px; }
@media (max-width: 480px) {
  .active-session-shortcuts--mobile .active-session-shortcut { width: 36px; padding: 0; justify-content: center; }
  .active-session-shortcuts--mobile :deep(.share-sidebar-label) { display: none; }
}
</style>
