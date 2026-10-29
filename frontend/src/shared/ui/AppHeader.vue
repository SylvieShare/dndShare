<template>
  <WorkspaceHeader page class="app-header" :split-navigation="isCharacterList" @resize="emit('resize', $event)" :style="{ '--workspace-header-identity-gap': 'var(--spacing-small)' }" :class="{
    'app-header--collapsible': headerCollapsible,
    'app-header--mobile-hidden': mobileHeaderHidden,
    'header-hidden': effectiveHeaderHidden,
  }">
    <template #identity>
      <button v-if="compact" class="header-menu" type="button" aria-label="Открыть меню"
        :aria-expanded="menuOpen" aria-controls="app-navigation-drawer" @click="emit('open-menu')">
        <Menu :size="24" aria-hidden="true" />
      </button>
      <MobileHeaderBack v-if="mobileBackTarget && (!isHandbook || route.query.item)" :to="mobileBackTarget" :icon-only="isHandbook" />
      <div class="header-heading">
        <slot name="title"><span class="header-title">{{ title }}</span></slot>
        <span v-if="contextLabel && compact" class="header-context">{{ contextLabel }}</span>
      </div>
    </template>
    <template v-if="isCharacterList" #navigation><div id="app-character-subheader" class="character-subheader-outlet" /></template>
    <template #actions>
      <div id="app-header-actions" class="header-actions" />
      <span v-if="headerContext.chip" class="header-chip"
        :style="headerContext.chip.color ? { '--chip-color': headerContext.chip.color } : {}">
        {{ headerContext.chip.label }}
      </span>
    </template>
  </WorkspaceHeader>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Menu } from '@lucide/vue'
import { useAppLayout } from '@/shared/composables/useAppLayout'
import WorkspaceHeader from './WorkspaceHeader.vue'
import MobileHeaderBack from '@/shared/ui/MobileHeaderBack.vue'
import { resolveMobileBackTarget } from '@/shared/lib/mobileBack'
import { gameContextPresentation } from '@/shared/lib/gameContextPresentation'
import { useUiStore } from '@/stores/ui'
import { useGameContextStore } from '@/stores/gameContext'
import { MOBILE_HEADER_COLLAPSIBLE, MOBILE_HEADER_HIDDEN, resolveMobileHeaderMode } from '@/shared/lib/mobileHeader'

defineProps({ menuOpen: Boolean })
const emit = defineEmits(['open-menu', 'resize'])
const route = useRoute()
const uiStore = useUiStore()
const gameContext = useGameContextStore()
const { phone, compact } = useAppLayout()
const headerMode = computed(() => resolveMobileHeaderMode(route.meta))
const headerCollapsible = computed(() => phone.value && headerMode.value === MOBILE_HEADER_COLLAPSIBLE)
const mobileHeaderHidden = computed(() => phone.value && headerMode.value === MOBILE_HEADER_HIDDEN)
const effectiveHeaderHidden = computed(() => headerCollapsible.value && uiStore.headerHidden)
const mobileBackTarget = computed(() => resolveMobileBackTarget(route))
const headerContext = computed(() => uiStore.resolveHeader(route.name, route.meta?.title, false))
const isCharacterList = computed(() => route.path === '/chars')
const isHandbook = computed(() => route.meta?.section === 'handbook')
const sectionTitles = { handbook: 'Справочник', rules: 'Правила игрока' }
const title = computed(() => isCharacterList.value ? 'DnD Share' : sectionTitles[route.meta?.section] || headerContext.value.title)
const contextLabel = computed(() => {
  const current = gameContextPresentation(gameContext.selectedSource, gameContext.selectedVersion)
  return [current.name, current.edition].filter(Boolean).join(' · ')
})
</script>

<style scoped>
.app-header {
  position: relative;
  z-index: 30;
  max-height: none;
  transition: max-height .22s ease, opacity .18s ease, border-color .22s ease;
}
.character-subheader-outlet { width: 100%; min-width: 0; }
.header-menu {
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  width: var(--layout-touch-min); height: var(--layout-touch-min); padding: 0; border: 0; border-radius: var(--radius-row);
  background: transparent; color: var(--text-1); cursor: pointer;
}
.header-menu:hover { background: var(--surface-raised); }
.header-heading { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; padding: 0; }
.header-title { font-family: var(--type-header-family); letter-spacing: var(--type-header-tracking); font-size: var(--type-header-size); line-height: var(--type-header-line-height); font-weight: var(--type-header-weight); }
.header-context { color: var(--text-2); font-family: var(--type-context-family); letter-spacing: var(--type-context-tracking); font-size: var(--type-context-size); line-height: var(--type-context-line-height); font-weight: var(--type-context-weight); }
.header-title, .header-context { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.header-actions { display: flex; align-items: center; flex: 0 0 auto; }
.header-actions:empty { display: none; }
.header-chip { color: var(--chip-color, var(--text-2)); font-size: 12px; flex-shrink: 0; }
.app-header--collapsible { position: sticky; top: 0; }
.app-header--mobile-hidden, .header-hidden { max-height: 0; opacity: 0; overflow: hidden; border-bottom-width: 0; pointer-events: none; }

@media (prefers-reduced-motion: reduce) { .app-header { transition: none; } }
</style>
