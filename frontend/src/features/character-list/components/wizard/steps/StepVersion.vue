<template>
  <div class="step">
    <div class="sheet-section-title">Версия правил</div>
    <p class="hint">По какой редакции создаём персонажа.</p>
    <div class="grid">
      <button class="ver" :class="{ on: state.version === '2014' }" @click="state.version = '2014'">
        <span v-if="state.version === '2014'" class="ver-strip" />
        <div class="ver-badge">2014</div>
        <div class="ver-title">Player's Handbook</div>
        <div class="ver-desc">Классические правила 5-й редакции.</div>
        <svg v-if="state.version === '2014'" class="ver-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6" /></svg>
      </button>

      <button class="ver soon" disabled>
        <span class="soon-tag">Скоро</span>
        <div class="ver-badge">2024</div>
        <div class="ver-title">Обновлённые правила</div>
        <div class="ver-desc">Редакция 2024 года — в разработке.</div>
      </button>
    </div>

    <div class="sources">
      <div class="sheet-section-title">Источники персонажа</div>
      <p class="hint">Ограничь книги, из которых можно выбирать расы, классы, черты, заклинания и снаряжение.</p>
      <ContentSourceSelector
        :source-version-id="sourceVersionId"
        :model-value="state.contentSources"
        @update:model-value="state.contentSources = $event"
      />
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import ContentSourceSelector from '@/features/character-editor/components/ContentSourceSelector.vue'

const { state, sourceVersionId } = inject('createWizard')
</script>

<style scoped>
.step { display: flex; flex-direction: column; gap: 12px; }
.hint { font-size: 12px; color: var(--text-muted); margin: 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.sources { display: flex; flex-direction: column; gap: 9px; margin-top: 8px; }
.ver {
  position: relative; text-align: left;
  background: var(--surface); border: none; border-radius: var(--r-lg);
  padding: 18px 18px 16px; cursor: pointer; overflow: hidden; transition: background 0.15s;
}
.ver:not(.soon):hover { background: color-mix(in srgb, var(--accent) 12%, var(--surface)); }
.ver.on { background: color-mix(in srgb, var(--accent) 16%, var(--surface)); }
.ver.soon { opacity: 0.55; cursor: default; }
.ver-strip { position: absolute; top: 12px; bottom: 12px; left: 0; width: 3px; border-radius: 0 2px 2px 0; background: var(--accent); }
.ver-badge { font-family: var(--font-ui); font-size: 30px; font-weight: 700; color: var(--accent); line-height: 1; font-variant-numeric: tabular-nums; }
.ver.soon .ver-badge { color: var(--text-muted); }
.ver-title { font-size: 15px; font-weight: 600; color: var(--text-1); margin-top: 8px; }
.ver-desc { font-size: 12px; color: var(--text-muted); margin-top: 3px; }
.ver-check { position: absolute; top: 16px; right: 16px; width: 18px; height: 18px; color: var(--accent); }
.soon-tag { position: absolute; top: 14px; right: 14px; font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--warning); background: color-mix(in srgb, var(--warning) 16%, transparent); padding: 2px 8px; border-radius: 999px; }
</style>
