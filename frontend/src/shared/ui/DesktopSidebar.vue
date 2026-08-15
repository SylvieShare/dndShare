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

    <SidebarNavItem
      v-for="item in navigationItems"
      :key="item.key"
      :as="RouterLink"
      :to="item.to"
      :label="item.title"
      :active="item.active"
      :icon="icons[item.key]"
    />

    <template #tools="{ expanded, expand }">
      <SidebarNavItem
        v-if="!expanded"
        as="button"
        label="Поиск"
        title="Открыть поиск"
        :icon="Search"
        @click="expand"
      />
      <HeaderSearch v-else class="sidebar-search" />
    </template>

    <template #account>
      <UserBox />
    </template>
  </AppSidebar>
</template>

<script setup>
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { BookOpen, Dices, ScrollText, Search, Shield, Users } from '@lucide/vue'
import { AppSidebar, SidebarBrand, SidebarNavItem } from '@sylvieshare/share-ui'
import HeaderSearch from '@/shared/ui/HeaderSearch'
import UserBox from '@/features/auth/components/UserBox'
import { resolveAppNavigation } from '@/shared/lib/appNavigation'
import { useAccountStore } from '@/stores/account'

const route = useRoute()
const accountStore = useAccountStore()

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
  inset: auto auto 0 calc(100% + 12px);
}

.desktop-sidebar :deep(.share-sidebar-account .user-box),
.desktop-sidebar :deep(.share-sidebar-account .user-info),
.desktop-sidebar :deep(.share-sidebar-account .user-trigger) { width: 100%; }

.desktop-sidebar :deep(.share-sidebar-account .user-trigger) { box-sizing: border-box; }
.desktop-sidebar :deep(.share-sidebar-account .user-menu) { inset: auto auto 0 calc(100% + 12px); }

.desktop-sidebar:not(.app-sidebar--expanded) :deep(.share-sidebar-account .user-name),
.desktop-sidebar:not(.app-sidebar--expanded) :deep(.share-sidebar-account .trigger-arrow),
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
