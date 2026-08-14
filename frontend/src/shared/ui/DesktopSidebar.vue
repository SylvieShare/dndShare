<template>
  <aside class="app-sidebar" :class="{ 'app-sidebar--expanded': expanded }">
    <div class="sidebar-head">
      <router-link class="sidebar-brand" to="/" aria-label="DnD Share">
        <Dices class="sidebar-brand-icon" :size="22" :stroke-width="1.8" aria-hidden="true" />
        <span class="sidebar-label sidebar-brand-label">DnD Share</span>
      </router-link>
    </div>

    <nav class="sidebar-nav" aria-label="Основная навигация">
      <router-link
        v-for="item in navigationItems"
        :key="item.key"
        class="sidebar-link"
        :class="{ active: item.active }"
        :to="item.to"
        :title="expanded ? undefined : item.title"
      >
        <component :is="icons[item.key]" class="sidebar-icon" :size="20" :stroke-width="1.8" aria-hidden="true" />
        <span class="sidebar-label">{{ item.title }}</span>
      </router-link>
    </nav>

    <div class="sidebar-tools">
      <button
        class="sidebar-toggle"
        type="button"
        :aria-label="expanded ? 'Свернуть панель' : 'Раскрыть панель'"
        :title="expanded ? 'Свернуть панель' : 'Раскрыть панель'"
        @click="toggle"
      >
        <PanelLeftClose v-if="expanded" class="sidebar-icon" :size="18" aria-hidden="true" />
        <PanelLeftOpen v-else class="sidebar-icon" :size="18" aria-hidden="true" />
        <span class="sidebar-label">{{ expanded ? 'Свернуть панель' : 'Раскрыть панель' }}</span>
      </button>

      <button
        v-if="!expanded"
        class="sidebar-link sidebar-search-trigger"
        type="button"
        title="Поиск"
        aria-label="Открыть поиск"
        @click="expandForSearch"
      >
        <Search class="sidebar-icon" :size="20" :stroke-width="1.8" aria-hidden="true" />
      </button>
      <HeaderSearch v-else class="sidebar-search" />
    </div>

    <div class="sidebar-account">
      <UserBox />
    </div>
  </aside>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  BookOpen,
  Dices,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Search,
  Shield,
  Users,
} from '@lucide/vue'
import HeaderSearch from '@/shared/ui/HeaderSearch'
import UserBox from '@/features/auth/components/UserBox'
import { resolveAppNavigation } from '@/shared/lib/appNavigation'
import { useAccountStore } from '@/stores/account'

const STORAGE_KEY = 'dndshare-desktop-sidebar-expanded'
const route = useRoute()
const accountStore = useAccountStore()
const expanded = ref(readExpandedState())

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

watch(expanded, value => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // Persistence is optional when storage is unavailable.
  }
})

function readExpandedState() {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function toggle() {
  expanded.value = !expanded.value
}

function expandForSearch() {
  expanded.value = true
}
</script>

<style scoped>
.app-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 60;
  width: var(--sidebar-collapsed-w);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: visible;
  border-right: 1px solid var(--border);
  background: var(--bg);
  transition:
    width 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.2s ease;
}

.app-sidebar--expanded {
  width: var(--sidebar-expanded-w);
  box-shadow: var(--shadow-lg);
}

.sidebar-head {
  height: 64px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 0 10px;
  border-bottom: 1px solid var(--border);
}

.sidebar-brand,
.sidebar-toggle,
.sidebar-link {
  color: var(--text-2);
  text-decoration: none;
}

.sidebar-brand {
  min-width: 0;
  height: 42px;
  display: flex;
  flex: 1;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  border-radius: 9px;
  color: var(--accent);
}

.sidebar-brand-icon,
.sidebar-icon {
  width: 42px;
  flex: 0 0 42px;
}

.sidebar-brand-label {
  font-weight: 700;
  letter-spacing: 0.03em;
}

.sidebar-toggle {
  width: 100%;
  height: 44px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0;
  border: none;
  border-radius: 9px;
  background: transparent;
  font: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s ease, background 0.15s ease;
}

.sidebar-toggle:hover {
  color: var(--text-1);
  background: var(--surface-raised);
}

.sidebar-toggle .sidebar-label {
  color: var(--text-muted);
  font-size: 12px;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 10px 10px;
}

.sidebar-link {
  position: relative;
  width: 100%;
  height: 44px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  gap: 12px;
  padding: 0;
  border: none;
  border-radius: 9px;
  background: transparent;
  font: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s ease, background 0.15s ease;
}

.sidebar-link::before {
  content: '';
  position: absolute;
  inset: 8px auto 8px -10px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--accent);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.sidebar-link:hover {
  color: var(--text-1);
  background: var(--surface-raised);
}

.sidebar-link.active {
  color: var(--text-1);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.sidebar-link.active::before {
  opacity: 1;
}

.sidebar-link.active .sidebar-icon {
  color: var(--accent-soft);
}

.sidebar-label {
  min-width: 0;
  overflow: hidden;
  opacity: 0;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
  transform: translateX(-5px);
  transition: opacity 0.14s ease, transform 0.22s ease;
}

.app-sidebar--expanded .sidebar-label {
  opacity: 1;
  transform: translateX(0);
  transition-delay: 0.05s;
}

.sidebar-tools {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  border-top: 1px solid var(--border);
}

.sidebar-search-trigger {
  color: var(--text-2);
}

.sidebar-search {
  width: 100%;
  height: 44px;
  display: flex;
  align-items: center;
}

.sidebar-search :deep(.hs-input-row),
.sidebar-search :deep(.hs-input-row.focused),
.sidebar-search :deep(.hs-input-row:focus-within) {
  width: 100%;
  box-sizing: border-box;
}

.sidebar-search :deep(.hs-dropdown) {
  right: auto;
  bottom: 0;
  left: calc(100% + 12px);
  top: auto;
}

.sidebar-account {
  min-height: 54px;
  padding: 10px;
  border-top: 1px solid var(--border);
}

.sidebar-account :deep(.user-box),
.sidebar-account :deep(.user-info),
.sidebar-account :deep(.user-trigger) {
  width: 100%;
}

.sidebar-account :deep(.user-trigger) {
  box-sizing: border-box;
}

.sidebar-account :deep(.user-menu) {
  inset: auto auto 0 calc(100% + 12px);
}

.app-sidebar:not(.app-sidebar--expanded) .sidebar-account :deep(.user-name),
.app-sidebar:not(.app-sidebar--expanded) .sidebar-account :deep(.trigger-arrow),
.app-sidebar:not(.app-sidebar--expanded) .sidebar-account :deep(.reg-link) {
  display: none;
}

.app-sidebar:not(.app-sidebar--expanded) .sidebar-account :deep(.auth-btn) {
  width: 42px;
  overflow: hidden;
  padding: 0;
  color: transparent;
  font-size: 0;
}

.app-sidebar:not(.app-sidebar--expanded) .sidebar-account :deep(.auth-btn)::before {
  content: '↪';
  color: var(--text-on-accent);
  font-size: 18px;
}

@media (max-width: 640px) {
  .app-sidebar {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-sidebar,
  .sidebar-label {
    transition: none;
  }
}
</style>
