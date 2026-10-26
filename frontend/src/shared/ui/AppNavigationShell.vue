<template>
  <DesktopSidebar v-if="!phone" :key="compact ? 'rail' : 'desktop'" :mode="compact ? 'rail' : 'desktop'" @open-menu="openMenu" />
  <div v-if="compact" class="app-compact-header">
    <AppHeader :menu-open="menuOpen" @open-menu="openMenu" />
  </div>
  <AppDrawer v-if="compact" id="app-navigation-drawer" v-model="menuOpen" aria-label="Меню приложения"
    :show-close="false" :width="288" :z-index="100" swipe-to-close>
    <DesktopSidebar ref="drawerSidebar" mode="drawer" @close-menu="menuOpen = false" @navigate="menuOpen = false" />
  </AppDrawer>
  <AppAuthDialogs />
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { AppDrawer } from '@sylvieshare/share-ui'
import AppHeader from './AppHeader.vue'
import AppAuthDialogs from '@/features/auth/components/AppAuthDialogs.vue'
import DesktopSidebar from './DesktopSidebar.vue'
import { useAppLayout } from '@/shared/composables/useAppLayout'
import { useAppDrawerGesture } from '@/shared/composables/useAppDrawerGesture'
import { useAccountStore } from '@/stores/account'

const { phone, compact } = useAppLayout()
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
.app-compact-header { margin-left: var(--app-sidebar-w); }
</style>
