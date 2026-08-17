<template>
  <AppSidebar
    class="desktop-sidebar"
    storage-key="dndshare-desktop-sidebar-expanded"
    :mobile-breakpoint="640"
    aria-label="Основная навигация"
    expand-label="Раскрыть панель"
    collapse-label="Свернуть панель"
  >
    <template #brand>
      <SidebarBrand :as="RouterLink" to="/" label="DnD Share" aria-label="DnD Share" :icon="Dices" />
    </template>

    <template #default="{ expanded, toggle }">
      <SidebarNavItem
        v-if="!expanded"
        as="button"
        label="Поиск"
        title="Открыть поиск"
        :icon="Search"
        @click="openSearch(toggle)"
      />
      <HeaderSearch v-else ref="searchRef" class="sidebar-search" />

      <div class="sidebar-search-separator" />

      <SidebarNavItem
        v-for="item in navigationItems"
        :key="item.key"
        :as="RouterLink"
        :to="item.to"
        :label="item.title"
        :active="item.active"
        :icon="icons[item.key]"
      />
    </template>

    <template #tools>
      <SidebarNavItem
        class="sidebar-error-action"
        as="button"
        label="На странице ошибка"
        title="Сообщить об ошибке на странице (Alt+Shift+E)"
        :icon="CircleAlert"
        @click="requestErrorReport"
      />
    </template>

    <template #account="{ expanded }">
      <UserBox :expanded="expanded" />
    </template>
  </AppSidebar>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { BookOpen, CircleAlert, Dices, ScrollText, Search, Shield, Users } from '@lucide/vue'
import { AppSidebar, SidebarBrand, SidebarNavItem } from '@sylvieshare/share-ui'
import HeaderSearch from '@/shared/ui/HeaderSearch'
import UserBox from '@/features/auth/components/UserBox'
import { resolveAppNavigation } from '@/shared/lib/appNavigation'
import { useAccountStore } from '@/stores/account'
import { requestErrorReport } from '@/features/error-report/lib/errorReportLauncher'

const route = useRoute()
const accountStore = useAccountStore()
const searchRef = ref(null)

const icons = {
  handbook: BookOpen,
  sessions: ScrollText,
  characters: Users,
  admin: Shield,
}

const navigationItems = computed(() => resolveAppNavigation({
  authenticated: accountStore.authStatus === 'success',
  admin: accountStore.hasRole('ADMIN'),
  path: route.path,
}))

async function openSearch(toggle) {
  toggle()
  await nextTick()
  searchRef.value?.focus()
}
</script>

<style scoped>
.desktop-sidebar :deep(.sidebar-search) {
  display: flex;
  align-items: center;
  width: 100%;
  height: 44px;
}

.desktop-sidebar :deep(.sidebar-search .hs-input-row),
.desktop-sidebar :deep(.sidebar-search .hs-input-row.focused),
.desktop-sidebar :deep(.sidebar-search .hs-input-row:focus-within) {
  box-sizing: border-box;
  width: 100%;
}

.desktop-sidebar :deep(.sidebar-search .hs-dropdown) {
  inset: 0 auto auto calc(100% + 12px);
}

.desktop-sidebar :deep(.share-sidebar-nav:has(.sidebar-search .hs-dropdown)) {
  overflow: visible;
}

.sidebar-search-separator {
  height: 1px;
  margin: 4px 2px 6px;
  background: var(--border);
}

.desktop-sidebar :deep(.share-sidebar-tools .sidebar-error-action) { order: 1; }
.desktop-sidebar :deep(.share-sidebar-tools .sidebar-toggle) { order: 2; }
.desktop-sidebar :deep(.sidebar-error-action .sidebar-icon) { color: var(--danger); }

.desktop-sidebar :deep(.share-sidebar-account .user-box) { width: 100%; }

.desktop-sidebar:not(.app-sidebar--expanded) :deep(.share-sidebar-account .reg-link) { display: none; }

.desktop-sidebar:not(.app-sidebar--expanded) :deep(.share-sidebar-account .auth-btn) {
  width: 42px;
  padding: 0;
  overflow: hidden;
  color: transparent;
  font-size: 0;
}

.desktop-sidebar:not(.app-sidebar--expanded) :deep(.share-sidebar-account .auth-btn)::before {
  color: var(--text-on-accent);
  font-size: 18px;
  content: '↪';
}
</style>
