<template>
  <header class="app-header" :class="{ 'header-hidden': headerHidden, 'header-collapsing': collapsing }">
    <div class="header-inner">
      <div class="brand-wrap" v-click-outside="closeMenu">
        <button class="brand-btn" type="button" :class="{ open: menuOpen }" @click="toggleBrandMenu">
          <span>DnD Share</span>
          <span class="brand-arrow">▾</span>
        </button>
        <div v-if="menuOpen" class="brand-menu">
          <router-link
            v-for="item in visibleItems"
            :key="item.to"
            class="brand-menu-item"
            :class="{ active: item.active }"
            :to="item.to"
            @click="menuOpen = false"
          >
            {{ item.title }}
          </router-link>
        </div>
      </div>

      <HorizontalMenu class="header-nav" />

      <div v-if="headerTitle" class="header-title header-title-inline">{{ headerTitle }}</div>

      <HeaderSearch class="header-search" />

      <div class="header-right">
        <UserBox />
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import HeaderSearch from '@/shared/ui/HeaderSearch'
import HorizontalMenu from '@/shared/ui/HorizontalMenu'
import UserBox from "@/features/auth/components/UserBox"
import { useUiStore } from '@/stores/ui'
import { useAccountStore } from '@/stores/account'

const route = useRoute()
const router = useRouter()

const menuOpen = ref(false)
const collapsing = ref(false)
let _collapseTimer = null
let _onWindowScroll = null
let _onViewportChange = null
let _mobileHeaderQuery = null

const headerHidden = computed(() => useUiStore().headerHidden)
const headerTitle = computed(() => useUiStore().headerTitle || '')
const isAuth = computed(() => useAccountStore().authStatus === 'success')
const isHandbook = computed(() => route.path.startsWith('/handbook'))
const isTemplateAdmin = computed(() => useAccountStore().hasRole('TEMPLATE_ADMIN'))
const isAdmin = computed(() => useAccountStore().hasRole('ADMIN'))
const visibleItems = computed(() => {
  const items = [
    { title: 'Справочник', to: '/handbook', active: isHandbook.value },
  ]
  if (isAuth.value) {
    items.push({ title: 'Сессии', to: '/sessions', active: route.path.startsWith('/session') })
    items.push({ title: 'Персонажи', to: '/chars', active: route.path.startsWith('/char') || route.path === '/chars' })
  }
  if (isAuth.value && isTemplateAdmin.value) {
    items.push({ title: 'Шаблоны', to: '/templates', active: route.path.startsWith('/template') || route.path === '/templates' })
  }
  if (isAuth.value && isAdmin.value) {
    items.push({ title: 'Админка', to: '/admin', active: route.path === '/admin' })
  }
  return items
})

watch(headerHidden, (val) => {
  collapsing.value = true
  clearTimeout(_collapseTimer)
  if (!val) {
    _collapseTimer = setTimeout(() => { collapsing.value = false }, 300)
  }
})

onMounted(() => {
  _mobileHeaderQuery = window.matchMedia('(max-width: 640px)')
  _onViewportChange = () => {
    if (!_mobileHeaderQuery.matches) {
      useUiStore().setHeaderHidden(false)
    }
  }
  _mobileHeaderQuery.addEventListener('change', _onViewportChange)
  _onViewportChange()

  _onWindowScroll = () => {
    const uiStore = useUiStore()
    uiStore.setScrollY(window.scrollY)
    uiStore.setHeaderHidden(_mobileHeaderQuery.matches && window.scrollY > 10)
  }
  window.addEventListener('scroll', _onWindowScroll, { passive: true })
})

onBeforeUnmount(() => {
  clearTimeout(_collapseTimer)
  window.removeEventListener('scroll', _onWindowScroll)
  _mobileHeaderQuery?.removeEventListener('change', _onViewportChange)
})

function closeMenu() {
  menuOpen.value = false
}

function toggleBrandMenu() {
  if (!window.matchMedia('(max-width: 640px)').matches) {
    router.push('/')
    return
  }
  menuOpen.value = !menuOpen.value
}

</script>

<style scoped>
.app-header {
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  position: relative;
  z-index: 30;
  max-height: none;
  opacity: 1;
}

.header-inner {
  max-width: 1400px;
  margin: 0 auto;
  height: 54px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 18px;
  transform: translateY(0);
  transition:
    transform 0.34s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.24s ease;
}

.brand-wrap {
  position: relative;
  flex-shrink: 0;
}

.brand-btn {
  height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.03em;
  padding: 0 8px;
  cursor: pointer;
  white-space: nowrap;
  touch-action: manipulation;
}

.brand-btn:hover,
.brand-btn.open {
  background: var(--surface-raised);
}

.brand-arrow {
  display: none;
  color: var(--text-muted);
  font-size: 12px;
  transition: transform 0.15s ease;
}

.brand-btn.open .brand-arrow {
  transform: rotate(180deg);
}

.brand-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 150;
  min-width: 176px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: var(--popover-bg);
  box-shadow: var(--shadow-lg);
}

.header-nav {
  min-width: 0;
}

.brand-menu-item {
  border-radius: 7px;
  color: var(--text-2);
  font-size: 13px;
  padding: 8px 10px;
  text-decoration: none;
  white-space: nowrap;
}

.brand-menu-item:hover,
.brand-menu-item.active {
  color: var(--text-1);
  background: var(--surface-raised);
}

.header-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-1);
  font-size: 14px;
  font-weight: 600;
}

.header-title-inline {
  display: none;
}


.header-search {
  margin-left: auto;
  flex-shrink: 0;
}

.header-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .app-header {
    position: sticky;
    top: 0;
    max-height: 60px;
    transition:
      max-height 0.34s cubic-bezier(0.22, 1, 0.36, 1),
      opacity 0.24s ease,
      border-color 0.24s ease;
  }

  .app-header.header-collapsing {
    overflow: hidden;
  }

  .app-header.header-hidden {
    max-height: 0;
    opacity: 0;
    border-bottom-color: transparent;
  }

  .header-hidden .header-inner {
    opacity: 0;
    transform: translateY(-8px);
  }

  .brand-arrow {
    display: inline;
  }

  .header-nav {
    display: none;
  }

  .header-search {
    display: none;
  }

  .header-inner {
    height: 50px;
    padding: 0 8px;
    gap: 8px;
  }

  .brand-btn {
    max-width: 128px;
    padding: 0 6px;
    font-size: 14px;
  }

  .brand-btn span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .header-title {
    flex: 1;
    font-size: 13px;
  }

  .header-title-inline {
    display: block;
  }

  .header-title-strip {
    display: none;
  }
}
</style>
