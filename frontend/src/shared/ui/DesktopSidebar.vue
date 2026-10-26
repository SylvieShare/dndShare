<template>
  <AppSidebar
    class="desktop-sidebar"
    :class="`desktop-sidebar--${mode}`"
    :model-value="mode === 'desktop' ? undefined : mode === 'drawer'"
    :position="mode === 'drawer' ? 'embedded' : 'fixed'"
    :show-toggle="mode === 'desktop'"
    :storage-key="mode === 'desktop' ? 'dndshare-desktop-sidebar-expanded' : ''"
    :default-expanded="true"
    elevated
    :mobile-breakpoint="0"
    aria-label="Основная навигация"
    expand-label="Раскрыть панель"
    collapse-label="Свернуть панель"
  >
    <template #brand>
      <button v-if="mode === 'rail'" class="sidebar-menu-trigger" type="button" aria-label="Открыть меню"
        aria-controls="app-navigation-drawer" @click="emit('open-menu')">
        <img class="brand-mark" src="/brand-mark.webp" alt="" />
      </button>
      <template v-else>
      <SidebarBrand :as="RouterLink" to="/" label="DnD Share" aria-label="DnD Share">
        <template #icon>
          <img class="brand-mark" src="/brand-mark.webp" alt="" />
        </template>
      </SidebarBrand>
      <button v-if="mode === 'drawer'" class="sidebar-menu-trigger" type="button" aria-label="Закрыть меню" @click="emit('close-menu')">
        <X :size="24" aria-hidden="true" />
      </button>
      </template>
    </template>

    <template #default="{ expanded, toggle }">
      <ActiveSessionShortcuts />
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
          :title="item.title"
          :active="item.active"
          :icon="icons[item.key]"
          @click="emit('navigate')"
        />
      </template>
    </template>

    <template #account="{ expanded }">
      <UserBox :expanded="expanded" />
    </template>
  </AppSidebar>
</template>

<script setup>
import ActiveSessionShortcuts from '@/features/sessions/components/ActiveSessionShortcuts.vue'
import { computed, nextTick, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { BookOpen, BookOpenCheck, Map, ScrollText, Search, Shield, UserRoundPlus, Users, X } from '@lucide/vue'
import { AppSidebar, SidebarBrand, SidebarNavItem } from '@sylvieshare/share-ui'
import HeaderSearch from '@/shared/ui/HeaderSearch'
import GameContextSelector from '@/shared/ui/GameContextSelector.vue'
import UserBox from '@/features/auth/components/UserBox'
import { resolveAppNavigation } from '@/shared/lib/appNavigation'
import { useAccountStore } from '@/stores/account'
import { useGameContextStore } from '@/stores/gameContext'

const props = defineProps({ mode: { type: String, default: 'desktop' } })
const emit = defineEmits(['open-menu', 'close-menu', 'navigate'])
const route = useRoute()
const accountStore = useAccountStore()
const gameContextStore = useGameContextStore()
const searchRef = ref(null)

const icons = {
  handbook: BookOpen,
  rules: BookOpenCheck,
  sessions: ScrollText,
  maps: Map,
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

const GROUP_LABELS = { master: 'Для мастера', player: 'Для игрока', service: 'Служебное' }
function groupLabel(group) { return GROUP_LABELS[group] || '' }
function startsGroup(item) {
  const index = navigationItems.value.findIndex(entry => entry.key === item.key)
  return index === 0 || navigationItems.value[index - 1]?.group !== item.group
}

async function openSearch(toggle) {
  if (props.mode === 'rail') { emit('open-menu', 'search'); return }
  toggle()
  await nextTick()
  searchRef.value?.focus()
}
defineExpose({ focusSearch: () => searchRef.value?.focus() })
</script>

<style scoped>
.sidebar-menu-trigger {
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  width: 44px; height: 48px; border: 0; border-radius: 9px; padding: 0;
  color: var(--text-1); background: transparent; cursor: pointer;
}
.sidebar-menu-trigger:hover { background: var(--surface-raised); }
.desktop-sidebar--drawer :deep(.share-sidebar-brand) { flex: 1; min-width: 0; }
.desktop-sidebar--drawer :deep(.sidebar-search .hs-dropdown) {
  position: relative; inset: auto; min-width: 0; width: 100%; margin-top: 8px; max-height: 240px;
}
.desktop-sidebar--drawer :deep(.sidebar-search:has(.hs-dropdown)) { height: auto; flex-direction: column; }

.brand-mark {
  display: block;
  width: 40px;
  height: 40px;
  object-fit: contain;
}

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

.desktop-sidebar--desktop :deep(.sidebar-search .hs-dropdown) {
  inset: 0 auto auto calc(100% + 12px);
}

.desktop-sidebar--desktop :deep(.share-sidebar-nav:has(.sidebar-search .hs-dropdown)) {
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

.desktop-sidebar :deep(.share-sidebar-account .user-box) { width: 100%; }

</style>
