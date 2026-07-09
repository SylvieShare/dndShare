<template>
  <nav class="nav" v-click-outside="closeMobileMenu">
    <div class="desktop-nav" ref="navEl">
      <router-link
        v-for="item in visibleItems"
        :key="item.to"
        class="nav-link"
        :class="{ active: item.active }"
        :to="item.to"
      >{{ item.title }}</router-link>
      <span
        class="nav-indicator"
        :class="{ visible: indicator.visible }"
        :style="{ transform: `translateX(${indicator.left}px)`, width: indicator.width + 'px' }"
      ></span>
    </div>

    <button class="mobile-nav-trigger" type="button" :class="{ open: mobileOpen }" @click="mobileOpen = !mobileOpen">
      <span>{{ currentTitle }}</span>
      <span class="mobile-nav-arrow">▾</span>
    </button>

    <div v-if="mobileOpen" class="mobile-nav-dropdown">
      <router-link
        v-for="item in visibleItems"
        :key="item.to"
        class="mobile-nav-item"
        :class="{ active: item.active }"
        :to="item.to"
        @click="mobileOpen = false"
      >
        {{ item.title }}
      </router-link>
    </div>
  </nav>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useAccountStore } from '@/stores/account'
import { useRoute } from 'vue-router'

const vClickOutside = {
  beforeMount(el, binding) {
    el._clickOutside = e => { if (!el.contains(e.target)) binding.value() }
    document.addEventListener('mousedown', el._clickOutside)
    document.addEventListener('touchstart', el._clickOutside, { passive: true })
  },
  unmounted(el) {
    document.removeEventListener('mousedown', el._clickOutside)
    document.removeEventListener('touchstart', el._clickOutside)
  },
}

const route = useRoute()

const mobileOpen = ref(false)
const navEl = ref(null)
const indicator = reactive({ left: 0, width: 0, visible: false })
let resizeObserver = null
let initialized = false

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
const currentTitle = computed(() => visibleItems.value.find(item => item.active)?.title || 'Меню')

function closeMobileMenu() {
  mobileOpen.value = false
}

function updateIndicator() {
  const root = navEl.value
  if (!root) return
  const activeLink = root.querySelector('.nav-link.active')
  if (!activeLink) {
    indicator.visible = false
    return
  }
  const rootRect = root.getBoundingClientRect()
  const linkRect = activeLink.getBoundingClientRect()
  const left = linkRect.left - rootRect.left + 8
  const width = Math.max(0, linkRect.width - 16)
  if (!initialized) {
    indicator.left = left
    indicator.width = width
    initialized = true
    requestAnimationFrame(() => { indicator.visible = true })
  } else {
    indicator.left = left
    indicator.width = width
    indicator.visible = true
  }
}

watch(visibleItems, () => nextTick(updateIndicator), { deep: true })
watch(() => route.fullPath, () => nextTick(updateIndicator))

onMounted(() => {
  nextTick(updateIndicator)
  if (typeof ResizeObserver !== 'undefined' && navEl.value) {
    resizeObserver = new ResizeObserver(() => updateIndicator())
    resizeObserver.observe(navEl.value)
  }
  window.addEventListener('resize', updateIndicator)
})

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect()
  window.removeEventListener('resize', updateIndicator)
})
</script>

<style scoped>
.nav {
  position: relative;
  min-width: 0;
}

.desktop-nav {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-link {
  position: relative;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-2);
  text-decoration: none;
  transition: color 0.2s ease;
}

.nav-link:hover {
  color: var(--text-1);
}

.nav-link.active {
  color: #fff;
}

.nav-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  border-radius: 2px;
  background: var(--accent);
  pointer-events: none;
  opacity: 0;
  transform: translateX(0);
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), width 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease;
  will-change: transform, width;
}

.nav-indicator.visible {
  opacity: 1;
}

.mobile-nav-trigger,
.mobile-nav-dropdown {
  display: none;
}

@media (max-width: 640px) {
  .desktop-nav {
    display: none;
  }

  .mobile-nav-trigger {
    min-width: 0;
    max-width: 154px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    border: 1px solid #2f2f36;
    border-radius: 7px;
    background: #202024;
    color: var(--text-1);
    font: inherit;
    font-size: 13px;
    padding: 0 9px 0 11px;
    cursor: pointer;
    touch-action: manipulation;
  }

  .mobile-nav-trigger span:first-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-nav-arrow {
    color: var(--text-muted);
    transition: transform 0.15s ease;
  }

  .mobile-nav-trigger.open .mobile-nav-arrow {
    transform: rotate(180deg);
  }

  .mobile-nav-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    z-index: 120;
    min-width: 166px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    border: 1px solid #2a2a2e;
    border-radius: 10px;
    background: #1e1e22;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  }

  .mobile-nav-item {
    border-radius: 7px;
    color: var(--text-2);
    font-size: 13px;
    padding: 8px 10px;
    text-decoration: none;
    white-space: nowrap;
  }

  .mobile-nav-item.active {
    color: #fff;
    background: #2a2a2e;
  }
}
</style>
