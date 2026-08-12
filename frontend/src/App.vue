<template>
  <AppHeader v-if="!isPrintRoute"/>
  <!-- The character LIST is kept alive so returning from a character page restores
       its scroll position and avoids a refetch flash. -->
  <div class="page-transition-stage" :class="{ 'page-transition-stage--print': isPrintRoute }">
    <router-view v-slot="{ Component, route }">
      <transition :name="pageTransitionName" :mode="pageTransitionMode">
        <keep-alive include="ViewListCharacters">
          <component :is="Component" :key="route.path"/>
        </keep-alive>
      </transition>
    </router-view>
  </div>
  <DiceRollPopup v-if="!isPrintRoute"/>
  <ErrorReporter v-if="!isPrintRoute"/>
  <ErrorReportInbox v-if="!isPrintRoute"/>
  <ConsoleErrorInbox v-if="!isPrintRoute"/>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from "@/shared/ui/AppHeader";
import DiceRollPopup from "@/shared/ui/DiceRollPopup.vue";
import ErrorReporter from '@/features/error-report/components/ErrorReporter.vue'
import ErrorReportInbox from '@/features/error-report/components/ErrorReportInbox.vue'
import ConsoleErrorInbox from '@/features/console-errors/components/ConsoleErrorInbox.vue'
import { pageTransitionName } from '@/app/router'
import { useIsMobile } from '@/shared/composables/useIsMobile'
import { useAccountStore } from '@/stores/account'
import { useTextStore } from '@/stores/text'

const route = useRoute()
const isMobile = useIsMobile()
const isPrintRoute = computed(() => !!route.meta?.printView)
const pageTransitionMode = computed(() => (isMobile.value ? undefined : 'out-in'))

onMounted(() => {
  useTextStore().downloadText()
  useAccountStore().checkAuth()
})
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&display=swap');

html, body {
  padding: 0;
  margin: 0;
}
body {
  background-color: var(--app-bg);
  color: var(--text-1);
  color-scheme: dark;
  overflow-x: clip;
  font-family: var(--font-ui);
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

.page-transition-stage {
  min-height: calc(100vh - var(--header-h));
  min-height: calc(100dvh - var(--header-h));
  background: var(--app-bg);
}

.page-transition-stage--print {
  min-height: 100vh;
  min-height: 100dvh;
}

.page-forward-enter-active,
.page-forward-leave-active,
.page-backward-enter-active,
.page-backward-leave-active {
  transition:
    transform 0.18s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.14s ease !important;
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

/* On narrow screens both routes overlap briefly instead of leaving an empty
   stage between the exit and entrance phases. The outgoing route is removed
   from flow so pages with different heights cannot push each other around. */
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
      transform 0.24s cubic-bezier(0.22, 1, 0.36, 1),
      opacity 0.2s ease !important;
    backface-visibility: hidden;
  }

  .page-forward-enter-active,
  .page-backward-enter-active {
    position: relative;
    z-index: 1;
  }

  .page-forward-leave-active,
  .page-backward-leave-active {
    position: absolute;
    z-index: 0;
    inset: 0 0 auto;
    width: 100%;
    pointer-events: none;
  }

  .page-forward-enter-from,
  .page-backward-leave-to {
    transform: translate3d(10px, 0, 0);
  }

  .page-forward-leave-to,
  .page-backward-enter-from {
    transform: translate3d(-10px, 0, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .page-forward-enter-active,
  .page-forward-leave-active,
  .page-backward-enter-active,
  .page-backward-leave-active {
    transition: none;
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

/* Anchored dropdown menu base — extend with own .position + .min-width */
.app-dropdown {
  position: absolute;
  background: var(--popover-bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-lg);
  z-index: 200;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
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
