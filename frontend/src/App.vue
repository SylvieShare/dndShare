<template>
  <AppHeader/>
  <!-- The character LIST is kept alive so returning from a character page restores
       its scroll position and avoids a refetch flash. -->
  <router-view v-slot="{ Component }">
    <keep-alive include="ViewListCharacters">
      <component :is="Component"/>
    </keep-alive>
  </router-view>
  <DiceRollPopup/>
</template>

<script setup>
import { onMounted } from 'vue'
import AppHeader from "@/shared/ui/AppHeader";
import DiceRollPopup from "@/shared/ui/DiceRollPopup.vue";
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
  --bg:         #181a24;
  --bg-deep:    #11121a;
  --block-bg:   #1f2230;   /* фон карточек-блоков */
  --group-bg:   #16171f;   /* фон групповых плиток-панелей (темнее задника) */
  --surface-1:  #26283e;   /* фон инпутов, кнопок */
  --surface-2:  #2d304b;   /* focused-состояние */
  --popup-bg:   #1c1f2a;   /* фон дропдаунов/тултипов */
  --input-bg:   #1e1e22;   /* фон полей форм в модалках */
  --input-border: #2e2e44; /* рамка полей форм в модалках */
  --input-focus: var(--accent);
  --border:     rgba(255,255,255,0.07);  /* разделители */
  --border-strong: rgba(255,255,255,0.14);
  --text-1:     #e8e8ef;   /* основной текст */
  --text-2:     #a6a6b8;   /* вторичный текст */
  --text-muted: #7c7c92;   /* заголовки секций */
  --accent:     #7c5cff;   /* акцент навигации (фиолетовый) */
  --accent-dim: #5a43cc;   /* акцент приглушённый */
  --accent-2:     #34c6ac; /* акцент позитивных действий (создать/войти) */
  --accent-2-dim: #2aa28d; /* позитивный приглушённый */
  --danger:     #e05555;   /* кнопки удалить, ошибки, hp-низкий */
  --danger-dim: #c95a52;   /* приглушённый danger (death-save пипсы, graveyard) */
  --success:    #4caf6e;   /* подтверждения, положительные индикаторы */
  --warning:    #fcbe24;   /* предупреждения, золото */
  --shadow-xs:  0 1px 1px rgba(0,0,0,0.25);
  --shadow-sm:  0 1px 2px rgba(0,0,0,0.4);
  --shadow-md:  0 4px 14px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04);
  --shadow-lg:  0 14px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
  --r-xs:       4px;
  --r-sm:       6px;
  --r-md:       10px;
  --r-lg:       14px;
  --r-pill:     999px;
  --font-display: 'Cormorant Garamond', 'Times New Roman', serif;
  --bg-header:  #1c1f2a;
  --color-attack: #a292ff;
}

html, body {
  padding: 0;
  margin: 0;
}
body {
  background-color: var(--bg-deep);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
#app {
  width: 100%;
  color: #fff;
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
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
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
::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #444; }

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
