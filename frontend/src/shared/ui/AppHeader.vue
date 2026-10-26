<template>
  <header class="app-header" :class="{
    'app-header--collapsible': headerCollapsible,
    'app-header--mobile-hidden': mobileHeaderHidden,
    'header-hidden': effectiveHeaderHidden,
  }">
    <div class="header-inner">
      <button class="header-menu" type="button" aria-label="Открыть меню"
        :aria-expanded="menuOpen" aria-controls="app-navigation-drawer" @click="emit('open-menu')">
        <Menu :size="24" aria-hidden="true" />
      </button>
      <MobileHeaderBack v-if="mobileBackTarget" :to="mobileBackTarget" />
      <div class="header-heading">
        <span class="header-title">{{ title }}</span>
        <span v-if="contextLabel" class="header-context">{{ contextLabel }}</span>
      </div>
      <span v-if="headerContext.chip" class="header-chip"
        :style="headerContext.chip.color ? { '--chip-color': headerContext.chip.color } : {}">
        {{ headerContext.chip.label }}
      </span>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Menu } from '@lucide/vue'
import { useIsMobile } from '@sylvieshare/share-ui'
import MobileHeaderBack from '@/shared/ui/MobileHeaderBack.vue'
import { resolveMobileBackTarget } from '@/shared/lib/mobileBack'
import { gameContextPresentation } from '@/shared/lib/gameContextPresentation'
import { useUiStore } from '@/stores/ui'
import { useGameContextStore } from '@/stores/gameContext'
import { MOBILE_HEADER_COLLAPSIBLE, MOBILE_HEADER_HIDDEN, resolveMobileHeaderMode } from '@/shared/lib/mobileHeader'

defineProps({ menuOpen: Boolean })
const emit = defineEmits(['open-menu'])
const route = useRoute()
const uiStore = useUiStore()
const gameContext = useGameContextStore()
const phone = useIsMobile(599)
const headerMode = computed(() => resolveMobileHeaderMode(route.meta))
const headerCollapsible = computed(() => phone.value && headerMode.value === MOBILE_HEADER_COLLAPSIBLE)
const mobileHeaderHidden = computed(() => phone.value && headerMode.value === MOBILE_HEADER_HIDDEN)
const effectiveHeaderHidden = computed(() => headerCollapsible.value && uiStore.headerHidden)
const mobileBackTarget = computed(() => resolveMobileBackTarget(route))
const headerContext = computed(() => uiStore.resolveHeader(route.name, route.meta?.title, false))
const sectionTitles = { handbook: 'Справочник', rules: 'Правила игрока' }
const title = computed(() => sectionTitles[route.meta?.section] || headerContext.value.title)
const contextLabel = computed(() => {
  const current = gameContextPresentation(gameContext.selectedSource, gameContext.selectedVersion)
  return [current.name, current.edition].filter(Boolean).join(' · ')
})
</script>

<style scoped>
.app-header {
  position: relative;
  z-index: 30;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  max-height: 65px;
  transition: max-height .22s ease, opacity .18s ease, border-color .22s ease;
}
.header-inner { display: flex; align-items: center; gap: 8px; min-height: 64px; padding: 0 16px; }
.header-menu {
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  width: 48px; height: 48px; padding: 0; border: 0; border-radius: 9px;
  background: transparent; color: var(--text-1); cursor: pointer;
}
.header-menu:hover { background: var(--surface-raised); }
.header-heading { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; padding: 8px 0; }
.header-title { font-size: 22px; line-height: 28px; }
.header-context { color: var(--text-2); font-size: 11px; line-height: 16px; font-weight: 500; }
.header-title, .header-context { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.header-chip { color: var(--chip-color, var(--text-2)); font-size: 12px; flex-shrink: 0; }
.app-header--collapsible { position: sticky; top: 0; }
.app-header--mobile-hidden, .header-hidden { max-height: 0; opacity: 0; overflow: hidden; border-bottom-width: 0; pointer-events: none; }
@media (max-width: 599px) { .header-inner { padding: 0 8px; } }
@media (min-width: 600px) { .header-menu { display: none; } }
@media (prefers-reduced-motion: reduce) { .app-header { transition: none; } }
</style>
