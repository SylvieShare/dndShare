<template>
  <DesktopSidebar v-if="!compact" mode="desktop" />
  <div v-if="(compact || route.meta?.section === 'handbook') && route.meta?.mobileHeader !== 'hidden'" class="app-header-shell">
    <AppHeader :menu-open="menuOpen" @open-menu="openMenu">
      <template v-if="route.meta?.section === 'handbook'" #title><HandbookHeading /></template>
    </AppHeader>
  </div>
  <AppDrawer v-if="compact" id="app-navigation-drawer" v-model="menuOpen" aria-label="Меню приложения"
    :show-close="false" :width="layoutTokens.drawer" :z-index="100" swipe-to-close>
    <DesktopSidebar ref="drawerSidebar" mode="drawer" @close-menu="menuOpen = false" @navigate="menuOpen = false" />
  </AppDrawer>
  <AppAuthDialogs />
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { AppDrawer } from '@sylvieshare/share-ui'
import { layoutTokens } from '@/app/design-tokens'
import AppHeader from './AppHeader.vue'
import HandbookHeading from '@/features/handbook/components/HandbookHeading.vue'
import AppAuthDialogs from '@/features/auth/components/AppAuthDialogs.vue'
import DesktopSidebar from './DesktopSidebar.vue'
import { useAppLayout } from '@/shared/composables/useAppLayout'
import { useAppDrawerGesture } from '@/shared/composables/useAppDrawerGesture'
import { useAccountStore } from '@/stores/account'

const { compact } = useAppLayout()
const route = useRoute()
const account = useAccountStore()
const menuOpen = ref(false)
const drawerSidebar = ref(null)
async function openMenu(intent) {
  if (!compact.value) return
  menuOpen.value = true
  if (intent === 'search') {
    await nextTick()
    drawerSidebar.value?.focusSearch()
  }
}
// Initial route/auth resolution fills an open menu without dismissing it.
watch([() => route.fullPath, () => route.name], (_, previous) => {
  if (previous[1] != null) menuOpen.value = false
})
watch(compact, () => { menuOpen.value = false })
watch(() => account.authStatus, status => {
  if (status === 'process') menuOpen.value = false
})
useAppDrawerGesture(() => compact.value && !menuOpen.value, openMenu)
</script>

<style scoped>
.app-header-shell { margin-left: var(--app-sidebar-w); transition: margin-left .28s cubic-bezier(.22, 1, .36, 1); }
@media (prefers-reduced-motion: reduce) { .app-header-shell { transition: none; } }
</style>
