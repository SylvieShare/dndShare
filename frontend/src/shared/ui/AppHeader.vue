<template>
  <header
    class="app-header"
    :class="{
      'app-header--collapsible': headerCollapsible,
      'app-header--mobile-hidden': mobileHeaderHidden,
      'header-hidden': effectiveHeaderHidden,
      'header-collapsing': headerCollapsible && collapsing,
    }"
  >
    <div class="header-inner">
      <MobileHeaderBack v-if="mobileBackTarget" :to="mobileBackTarget" />

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
          <button type="button" class="brand-menu-item brand-menu-report" @click="openErrorReporter">
            На странице ошибка
          </button>
        </div>
      </div>

      <span
        v-if="headerContext.chip"
        class="header-chip"
        :class="{ 'header-chip--status': headerContext.chip.color }"
        :style="headerContext.chip.color ? { '--chip-color': headerContext.chip.color } : {}"
      >
        <span v-if="headerContext.chip.color" class="header-chip-dot" aria-hidden="true" />
        {{ headerContext.chip.label }}
      </span>

      <div class="header-right">
        <UserBox />
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MobileHeaderBack from '@/shared/ui/MobileHeaderBack.vue'
import { resolveMobileBackTarget } from '@/shared/lib/mobileBack'
import UserBox from "@/features/auth/components/UserBox"
import { useUiStore } from '@/stores/ui'
import { useAccountStore } from '@/stores/account'
import {
  MOBILE_HEADER_COLLAPSIBLE,
  MOBILE_HEADER_HIDDEN,
  resolveMobileHeaderMode,
} from '@/shared/lib/mobileHeader'
import { resolveAppNavigation } from '@/shared/lib/appNavigation'
import { requestErrorReport } from '@/features/error-report/lib/errorReportLauncher'

const route = useRoute()
const router = useRouter()
const uiStore = useUiStore()

const menuOpen = ref(false)
const collapsing = ref(false)
let _collapseTimer = null

const headerHidden = computed(() => uiStore.headerHidden)
const headerMode = computed(() => resolveMobileHeaderMode(route.meta))
const headerCollapsible = computed(() => headerMode.value === MOBILE_HEADER_COLLAPSIBLE)
const mobileHeaderHidden = computed(() => headerMode.value === MOBILE_HEADER_HIDDEN)
const effectiveHeaderHidden = computed(() => headerCollapsible.value && headerHidden.value)
const isAuth = computed(() => useAccountStore().authStatus === 'success')
const mobileBackTarget = computed(() => resolveMobileBackTarget(route))
const isAdmin = computed(() => useAccountStore().hasRole('ADMIN'))
const headerContext = computed(() => uiStore.resolveHeader(
  route.name,
  route.meta?.title,
  false,
))
const visibleItems = computed(() => {
  return resolveAppNavigation({
    authenticated: isAuth.value,
    admin: isAdmin.value,
    path: route.path,
  })
})

watch(effectiveHeaderHidden, (val) => {
  collapsing.value = true
  clearTimeout(_collapseTimer)
  if (!val) {
    _collapseTimer = setTimeout(() => { collapsing.value = false }, 300)
  }
})

onBeforeUnmount(() => {
  clearTimeout(_collapseTimer)
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

function openErrorReporter() {
  menuOpen.value = false
  requestErrorReport()
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

.brand-menu-item {
  border-radius: 7px;
  color: var(--text-2);
  font-size: 13px;
  padding: 8px 10px;
  text-decoration: none;
  white-space: nowrap;
}

.brand-menu-report {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--danger);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.brand-menu-item:hover,
.brand-menu-item.active {
  color: var(--text-1);
  background: var(--surface-raised);
}

.header-chip {
  display: none;
}


.header-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .app-header.app-header--mobile-hidden {
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    border-bottom-width: 0;
    border-bottom-color: transparent;
    pointer-events: none;
  }

  .app-header {
    max-height: 51px;
    transition:
      max-height 0.38s cubic-bezier(0.22, 0.75, 0.25, 1),
      opacity 0.3s ease,
      border-width 0.38s cubic-bezier(0.22, 0.75, 0.25, 1),
      border-color 0.3s ease;
  }

  .app-header--mobile-hidden .header-inner {
    opacity: 0;
    transform: translateY(-10px);
  }

  .app-header.app-header--collapsible {
    position: sticky;
    top: 0;
    max-height: 51px;
  }

  .app-header--collapsible.header-collapsing {
    overflow: hidden;
  }

  .app-header--collapsible.header-hidden {
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

  .header-chip {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    gap: 5px;
    max-width: 112px;
    min-height: 22px;
    padding: 2px 7px;
    overflow: hidden;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface);
    color: var(--text-2);
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-chip--status {
    color: var(--chip-color);
  }

  .header-chip-dot {
    width: 6px;
    height: 6px;
    flex-shrink: 0;
    border-radius: 50%;
    background: currentColor;
  }

  .header-right {
    margin-left: auto;
  }

  .header-title-strip {
    display: none;
  }
}

@media (min-width: 641px) {
  .app-header {
    display: none;
  }
}
</style>
