<template>
  <DesktopSidebar v-if="!isStandaloneRoute" />
  <AppHeader v-if="!isStandaloneRoute"/>
  <!-- The character LIST is kept alive so returning from a character page restores
       its scroll position and avoids a refetch flash. -->
  <div
    class="page-transition-stage share-app-canvas"
    :class="{
      'page-transition-stage--print': isPrintRoute,
      'page-transition-stage--standalone': isStandaloneRoute,
    }"
  >
    <router-view v-slot="{ Component, route }">
      <transition
        :name="pageTransitionName"
        :mode="pageTransitionMode"
        :css="!mobilePageTransitionActive"
      >
        <keep-alive include="ViewListCharacters">
          <component :is="Component" :key="route.path"/>
        </keep-alive>
      </transition>
    </router-view>
  </div>
  <DiceRollPopup v-if="!isStandaloneRoute"/>
  <ErrorReporter v-if="!isStandaloneRoute && isAuthenticated"/>
  <ErrorReportInbox v-if="!isStandaloneRoute"/>
  <ConsoleErrorInbox v-if="!isStandaloneRoute"/>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from "@/shared/ui/AppHeader";
import DesktopSidebar from '@/shared/ui/DesktopSidebar.vue'
import DiceRollPopup from "@/shared/ui/DiceRollPopup.vue";
import ErrorReporter from '@/features/error-report/components/ErrorReporter.vue'
import ErrorReportInbox from '@/features/error-report/components/ErrorReportInbox.vue'
import ConsoleErrorInbox from '@/features/console-errors/components/ConsoleErrorInbox.vue'
import { pageTransitionName } from '@/app/router'
import { mobilePageTransitionActive } from '@/app/mobilePageTransition'
import { useIsMobile } from '@sylvieshare/share-ui'
import { useAccountStore } from '@/stores/account'
import { useTextStore } from '@/stores/text'
import { useGameContextStore } from '@/stores/gameContext'

const route = useRoute()
const isMobile = useIsMobile()
const isPrintRoute = computed(() => !!route.meta?.printView)
const isStandaloneRoute = computed(() => isPrintRoute.value || !!route.meta?.standaloneView)
const accountStore = useAccountStore()
const isAuthenticated = computed(() => accountStore.authStatus === 'success')
const pageTransitionMode = computed(() => (isMobile.value ? undefined : 'out-in'))

onMounted(() => {
  if (isStandaloneRoute.value) return
  useTextStore().downloadText()
  useGameContextStore().ensure().catch(() => null)
})
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500..700&family=Literata:ital,opsz,wght@0,7..72,400..700;1,7..72,400..700&display=swap');

html, body {
  padding: 0;
  margin: 0;
}
body {
  color-scheme: dark;
  overflow-x: clip;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
#app {
  width: 100%;
  color: var(--text-1);
}

::selection {
  color: var(--text-on-accent);
  background: color-mix(in srgb, var(--accent) 72%, transparent);
}

:where(button, a, input, textarea, select, [tabindex]):focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 76%, var(--text-on-accent));
  outline-offset: 2px;
}

@media (min-width: 641px) {
  body:has(.app-sidebar:not(.app-sidebar--expanded)) .review-inbox {
    left: calc(var(--app-sidebar-w) + 16px);
  }

  body:has(.app-sidebar--expanded) .page-transition-stage {
    margin-left: var(--sidebar-expanded-w);
  }

  body:has(.app-sidebar--expanded) .review-inbox {
    left: calc(var(--sidebar-expanded-w) + 16px);
  }
}

.page-transition-stage {
  min-height: calc(100vh - var(--header-h));
  min-height: calc(100dvh - var(--header-h));
  margin-left: var(--app-sidebar-w);
  transition: margin-left 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.page-transition-stage--print {
  min-height: 100vh;
  min-height: 100dvh;
  margin-left: 0;
  background-image: none;
}

.page-transition-stage--standalone {
  min-height: 100vh;
  min-height: 100dvh;
  margin-left: 0;
  background: none;
}

.page-forward-enter-active,
.page-forward-leave-active,
.page-backward-enter-active,
.page-backward-leave-active {
  transition:
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.18s ease !important;
  will-change: transform, opacity;
}

.page-forward-enter-from,
.page-backward-leave-to {
  opacity: 0;
  transform: translateX(18px);
}

.page-forward-leave-to,
.page-backward-enter-from {
  opacity: 0;
  transform: translateX(-18px);
}

/* Fallback for browsers without the View Transition API. Both routes overlap,
   and the outgoing route is removed from flow so page height cannot jump. */
@media (max-width: 768px) {
  .page-transition-stage {
    position: relative;
    isolation: isolate;
  }

  .page-forward-enter-active,
  .page-forward-leave-active,
  .page-backward-enter-active,
  .page-backward-leave-active {
    transition:
      transform 0.38s cubic-bezier(0.22, 0.75, 0.25, 1),
      opacity 0.3s ease !important;
    backface-visibility: hidden;
  }

  .page-forward-enter-active {
    position: relative;
    z-index: 2;
  }

  .page-forward-leave-active {
    position: absolute;
    z-index: 1;
    inset: 0 0 auto;
    width: 100%;
    pointer-events: none;
  }

  .page-backward-enter-active {
    position: relative;
    z-index: 1;
  }

  .page-backward-leave-active {
    position: absolute;
    z-index: 2;
    inset: 0 0 auto;
    width: 100%;
    pointer-events: none;
  }

  .page-forward-enter-from,
  .page-backward-leave-to {
    opacity: 0.35;
    transform: translate3d(22px, 0, 0) scale(0.995);
  }

  .page-forward-leave-to,
  .page-backward-enter-from {
    opacity: 0.45;
    transform: translate3d(-10px, 0, 0) scale(0.995);
  }
}

/* Modern mobile browsers animate one snapshot of the entire application.
   Header visibility and routed content therefore change in one composition
   pass, including the fullscreen character-sheet boundary. */
@media (max-width: 768px) {
  /* The root snapshot owns the motion. Internal header transitions are paused
     so the destination snapshot captures its final geometry, not frame one of
     a second animation. */
  html.mobile-page-transition .app-header,
  html.mobile-page-transition .app-header .header-inner {
    transition: none !important;
  }

  html.mobile-page-transition::view-transition-group(root) {
    animation-duration: 0.38s;
    animation-timing-function: cubic-bezier(0.22, 0.75, 0.25, 1);
  }

  html.mobile-page-transition::view-transition-old(root),
  html.mobile-page-transition::view-transition-new(root) {
    animation-duration: 0.38s;
    animation-fill-mode: both;
    animation-timing-function: cubic-bezier(0.22, 0.75, 0.25, 1);
    mix-blend-mode: normal;
  }

  html.mobile-page-transition--forward::view-transition-old(root) {
    z-index: 1;
    animation-name: mobile-page-old-forward;
  }

  html.mobile-page-transition--forward::view-transition-new(root) {
    z-index: 2;
    animation-name: mobile-page-new-forward;
  }

  html.mobile-page-transition--backward::view-transition-old(root) {
    z-index: 2;
    animation-name: mobile-page-old-backward;
  }

  html.mobile-page-transition--backward::view-transition-new(root) {
    z-index: 1;
    animation-name: mobile-page-new-backward;
  }
}

@keyframes mobile-page-old-forward {
  to {
    opacity: 0.5;
    transform: translate3d(-10px, 0, 0) scale(0.995);
  }
}

@keyframes mobile-page-new-forward {
  from {
    opacity: 0.35;
    transform: translate3d(22px, 0, 0) scale(0.995);
  }
}

@keyframes mobile-page-old-backward {
  to {
    opacity: 0;
    transform: translate3d(28px, 0, 0) scale(0.995);
  }
}

@keyframes mobile-page-new-backward {
  from {
    opacity: 0.72;
    transform: translate3d(-10px, 0, 0) scale(0.995);
  }
}

@media (prefers-reduced-motion: reduce) {
  .page-transition-stage {
    transition: none;
  }

  .page-forward-enter-active,
  .page-forward-leave-active,
  .page-backward-enter-active,
  .page-backward-leave-active {
    transition: none;
  }

  html.mobile-page-transition::view-transition-group(root),
  html.mobile-page-transition::view-transition-old(root),
  html.mobile-page-transition::view-transition-new(root) {
    animation: none;
  }
}

* {
  box-sizing: border-box;
  -moz-box-sizing: border-box;
  -webkit-box-sizing: border-box;
}

.sheet-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 28px;
  max-width: 100%;
  background: color-mix(in srgb, var(--surface-raised) 38%, var(--bg));
  border: 1px solid color-mix(in srgb, var(--border-strong) 58%, transparent);
  border-radius: 7px;
  padding: 4px 11px;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.15;
  user-select: none;
  overflow-wrap: anywhere;
  transition: border-color 0.12s, color 0.12s;
}

.sheet-tag-chip:hover {
  border-color: var(--border-strong);
  color: var(--text-1);
}

.sheet-tag-chip.sheet-tag-has-desc {
  cursor: help;
}

.sheet-tag-remove {
  background: none;
  border: none;
  color: var(--text-muted);
  line-height: 1;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease;
}

.sheet-tag-chip:hover .sheet-tag-remove {
  color: var(--danger);
}

/* Unified title style for the small header at the top of every block tile. */
.sheet-tile-title {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.09em;
  line-height: 1.15;
  text-transform: uppercase;
}

/* ─── Кастомный скроллбар ──────────────────────── */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--surface-active); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--text-1) 28%, var(--surface-active)); }

p { margin: 0 0 10px; }
p:last-child { margin-bottom: 0; }

@media (max-width: 640px) {
  input.is-input,
  input.sp-input,
  input.sa-input,
  input.vs-search,
  input.search-input,
  .desc-editor[contenteditable="true"] {
    font-size: 16px !important;
  }
}
</style>
