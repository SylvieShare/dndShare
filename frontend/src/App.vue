<template>
  <AppHeader/>
  <!-- The character LIST is kept alive so returning from a character page restores
       its scroll position and avoids a refetch flash. -->
  <div class="page-transition-stage">
    <router-view v-slot="{ Component, route }">
      <transition :name="pageTransitionName" mode="out-in">
        <keep-alive include="ViewListCharacters">
          <component :is="Component" :key="route.path"/>
        </keep-alive>
      </transition>
    </router-view>
  </div>
  <DiceRollPopup/>
  <ErrorReporter/>
  <ErrorReportInbox/>
</template>

<script setup>
import { onMounted } from 'vue'
import AppHeader from "@/shared/ui/AppHeader";
import DiceRollPopup from "@/shared/ui/DiceRollPopup.vue";
import ErrorReporter from '@/features/error-report/components/ErrorReporter.vue'
import ErrorReportInbox from '@/features/error-report/components/ErrorReportInbox.vue'
import { pageTransitionName } from '@/app/router'
import { useAccountStore } from '@/stores/account'
import { useTextStore } from '@/stores/text'

onMounted(() => {
  useTextStore().downloadText()
  useAccountStore().checkAuth()
})
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&display=swap');

:root {
  --header-h: 54px;
  --content-max: 1400px;   /* единая ширина контента страниц/тулбара/раскрытия */
  --bg-deep:    #121214;   /* самый глубокий фон приложения */
  --bg:         #1b1b1d;   /* основной графитовый фон */
  --block-bg:   #242427;   /* карточки и крупные блоки */
  --surface-1:  #2c2c30;   /* контролы и приподнятые поверхности */
  --surface-2:  #35353b;   /* hover / active поверхности */
  --surface-hover: #313136;
  --surface-active: #393940;
  --popup-bg:   #202024;   /* дропдауны, поповеры и тултипы */
  --input-bg:   #1f1f22;   /* поля форм в модалках */
  --input-border: #38383f; /* рамка полей форм */
  --input-focus: var(--accent);
  --border:     rgba(255,255,255,0.08);  /* тонкие разделители */
  --border-strong: rgba(255,255,255,0.16);
  --text-1:     #ececed;   /* основной текст */
  --text-2:     #a6a6ab;   /* вторичный текст */
  --text-muted: #8a8a92;   /* подписи и плейсхолдеры, AA на карточках */
  --text-faint: #73737b;   /* только декоративный и disabled-текст */
  --text-on-accent: #ffffff;
  --accent:     #7c5ce2;   /* единый продуктовый акцент, AA с белым текстом */
  --accent-dim: #6847c7;   /* pressed / насыщенный акцент */
  --accent-soft: #b9a8ff;  /* текст поверх спокойных акцентных подложек */
  --accent-2:     var(--accent);     /* legacy: primary CTA теперь тоже фиолетовый */
  --accent-2-dim: var(--accent-dim);
  --danger:     #e05555;   /* кнопки удалить, ошибки, hp-низкий */
  --danger-dim: #c95a52;   /* приглушённый danger (death-save пипсы, graveyard) */
  --success:    #4caf6e;   /* подтверждения, положительные индикаторы */
  --warning:    #fcbe24;   /* предупреждения, золото */
  --shadow-lg:  0 18px 48px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.05);
  --r-xs:       4px;
  --r-sm:       6px;
  --r-md:       10px;
  --r-lg:       14px;
  --r-pill:     999px;
  --font-ui: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
  --font-display: 'Cormorant Garamond', 'Times New Roman', serif;
  --bg-header:  #18181b;
  --color-attack: #aa98ff;
}

html, body {
  padding: 0;
  margin: 0;
}
body {
  background-color: var(--bg-deep);
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
  outline: 2px solid color-mix(in srgb, var(--accent) 76%, white);
  outline-offset: 2px;
}

.page-transition-stage {
  min-height: calc(100vh - var(--header-h));
  min-height: calc(100dvh - var(--header-h));
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
  background: color-mix(in srgb, var(--surface-1) 38%, var(--bg-deep));
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
  color: #e05555;
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
  background: var(--popup-bg);
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
::-webkit-scrollbar-thumb { background: var(--surface-2); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--surface-active); }

p { margin: 0 0 10px; }
p:last-child { margin-bottom: 0; }

@media (max-width: 640px) {
  :root { --header-h: 50px; }
}

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
