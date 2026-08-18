<template>
  <AppSidebar
    class="desktop-sidebar"
    storage-key="dndshare-desktop-sidebar-expanded"
    :default-expanded="true"
    :mobile-breakpoint="640"
    aria-label="Основная навигация"
    expand-label="Раскрыть панель"
    collapse-label="Свернуть панель"
  >
    <template #brand>
      <SidebarBrand :as="RouterLink" to="/" label="DnD Share" aria-label="DnD Share" :icon="Dices" />
    </template>

    <template #default="{ expanded, toggle }">
      <GameContextSelector :compact="!expanded" />
      <div class="sidebar-context-separator" />

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

      <template v-for="item in navigationItems" :key="item.key">
        <div
          v-if="startsGroup(item) && groupLabel(item.group)"
          class="sidebar-group-marker"
          :class="{ 'sidebar-group-marker--collapsed': !expanded }"
        >
          <span>{{ groupLabel(item.group) }}</span>
        </div>
        <SidebarNavItem
          :as="RouterLink"
          :to="item.to"
          :label="item.title"
          :active="item.active"
          :icon="icons[item.key]"
        />
      </template>
    </template>

    <template #tools>
      <SidebarNavItem
        v-if="isAuthenticated"
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
import { BookOpen, BookOpenCheck, CircleAlert, Dices, ScrollText, Search, Shield, UserRoundPlus, Users } from '@lucide/vue'
import { AppSidebar, SidebarBrand, SidebarNavItem } from '@sylvieshare/share-ui'
import HeaderSearch from '@/shared/ui/HeaderSearch'
import GameContextSelector from '@/shared/ui/GameContextSelector.vue'
import UserBox from '@/features/auth/components/UserBox'
import { resolveAppNavigation } from '@/shared/lib/appNavigation'
import { useAccountStore } from '@/stores/account'
import { useGameContextStore } from '@/stores/gameContext'
import { requestErrorReport } from '@/features/error-report/lib/errorReportLauncher'

const route = useRoute()
const accountStore = useAccountStore()
const gameContextStore = useGameContextStore()
const searchRef = ref(null)

const icons = {
  handbook: BookOpen,
  rules: BookOpenCheck,
  sessions: ScrollText,
  characters: Users,
  'create-character': UserRoundPlus,
  admin: Shield,
}

const navigationItems = computed(() => resolveAppNavigation({
  authenticated: accountStore.authStatus === 'success',
  hasCharacters: accountStore.user.hasCharacters,
  admin: accountStore.hasRole('ADMIN'),
  path: route.path,
  rulesTo: gameContextStore.rulesPath,
}))
const isAuthenticated = computed(() => accountStore.authStatus === 'success')

const GROUP_LABELS = { master: 'Для мастера', player: 'Для игрока', service: 'Служебное' }
function groupLabel(group) { return GROUP_LABELS[group] || '' }
function startsGroup(item) {
  const index = navigationItems.value.findIndex(entry => entry.key === item.key)
  return index === 0 || navigationItems.value[index - 1]?.group !== item.group
}

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

.sidebar-context-separator {
  height: 1px;
  margin: 6px 2px 4px;
  background: var(--border);
}

.desktop-sidebar :deep(.share-sidebar-nav:has(.game-context-panel--popover)) {
  overflow: visible;
}

.sidebar-group-marker {
  position: relative;
  display: flex;
  align-items: flex-end;
  box-sizing: border-box;
  height: 25px;
  padding: 7px 10px 3px;
  flex: 0 0 25px;
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: .1em;
  text-transform: uppercase;
}

.sidebar-group-marker--collapsed {
  align-items: center;
  justify-content: center;
  padding: 0 7px;
}

.sidebar-group-marker--collapsed::before {
  width: 28px;
  height: 1px;
  background: var(--border);
  content: '';
}

.sidebar-group-marker--collapsed > span {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.desktop-sidebar :deep(.share-sidebar-tools .sidebar-error-action) { order: 1; }
.desktop-sidebar :deep(.share-sidebar-tools .sidebar-toggle) { order: 2; }
.desktop-sidebar :deep(.sidebar-error-action .sidebar-icon) { color: var(--danger); }

.desktop-sidebar :deep(.share-sidebar-account .user-box) { width: 100%; }

</style>
