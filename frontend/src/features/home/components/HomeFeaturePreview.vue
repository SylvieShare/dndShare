<template>
  <div v-if="kind === 'sheet'" class="home-feature-preview home-sheet-preview" aria-hidden="true">
    <div class="home-sheet-name">
      <span />
      <small>Лиссара · плут 5</small>
    </div>
    <div class="home-sheet-stats">
      <span><strong>16</strong><small>ЛОВ</small></span>
      <span><strong>14</strong><small>ИНТ</small></span>
      <span><strong>12</strong><small>ХАР</small></span>
    </div>
    <div class="home-sheet-bars"><span /><span /><span /></div>
  </div>

  <div v-else-if="kind === 'wizard'" class="home-feature-preview home-wizard-preview" aria-hidden="true">
    <span class="is-done"><Check :size="12" /></span>
    <i />
    <span class="is-done"><Check :size="12" /></span>
    <i />
    <span class="is-current">3</span>
    <i />
    <span>4</span>
  </div>

  <div v-else-if="kind === 'handbook'" class="home-feature-preview home-handbook-preview" aria-hidden="true">
    <div><Search :size="13" /><span>огненный шар</span></div>
    <span>Заклинания</span>
    <span>Предметы</span>
    <span>Существа</span>
  </div>

  <div v-else class="home-feature-preview home-session-preview" aria-hidden="true">
    <small>Глава IV</small>
    <div class="home-session-route">
      <span class="is-past" />
      <i />
      <span class="is-current" />
      <i />
      <span />
    </div>
    <strong>Тайна старой башни</strong>
    <p>3 игрока · 8 сцен</p>
  </div>
</template>

<script setup>
import { Check, Search } from '@lucide/vue'

defineProps({
  kind: { type: String, required: true },
})
</script>

<style scoped>
.home-feature-preview {
  opacity: var(--home-preview-opacity);
}

.home-sheet-preview {
  position: absolute;
  display: var(--home-preview-display);
  right: 26px;
  bottom: -14px;
  width: 218px;
  height: 174px;
  box-sizing: border-box;
  padding: 18px;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
  border-radius: var(--r-lg) var(--r-lg) 0 0;
  background: color-mix(in srgb, var(--bg) 94%, var(--accent));
  box-shadow: var(--shadow-lg);
  transform: rotate(-2deg);
}

.home-sheet-preview::before {
  position: absolute;
  inset: 8px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  content: '';
}

.home-sheet-name,
.home-sheet-stats,
.home-sheet-bars {
  position: relative;
  z-index: 1;
}

.home-sheet-name span {
  width: 72%;
  height: 4px;
  display: block;
  margin-bottom: 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 46%, var(--border));
}

.home-sheet-name small {
  color: var(--text-muted);
  font-size: 8px;
}

.home-sheet-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
  margin-top: 15px;
}

.home-sheet-stats > span {
  height: 46px;
  display: grid;
  place-content: center;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--surface);
  text-align: center;
}

.home-sheet-stats strong {
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: 18px;
  line-height: 1;
}

.home-sheet-stats small {
  margin-top: 3px;
  color: var(--text-muted);
  font-size: 6px;
  font-weight: 800;
}

.home-sheet-bars {
  display: grid;
  gap: 6px;
  margin-top: 12px;
}

.home-sheet-bars span {
  height: 5px;
  border-radius: 999px;
  background: var(--border);
}

.home-sheet-bars span:nth-child(2) {
  width: 78%;
}

.home-sheet-bars span:nth-child(3) {
  width: 54%;
}

.home-wizard-preview {
  position: absolute;
  display: var(--home-preview-flex-display);
  right: 23px;
  bottom: 26px;
  align-items: center;
}

.home-wizard-preview span {
  width: 23px;
  height: 23px;
  display: grid;
  flex: none;
  place-items: center;
  border: 1px solid var(--border-strong);
  border-radius: 50%;
  background: var(--surface-raised);
  color: var(--text-muted);
  font-size: 8px;
  font-style: normal;
  font-weight: 800;
}

.home-wizard-preview i {
  width: 13px;
  height: 1px;
  background: var(--border-strong);
}

.home-wizard-preview .is-done,
.home-wizard-preview .is-current {
  border-color: color-mix(in srgb, var(--accent) 62%, var(--border));
  background: color-mix(in srgb, var(--accent) 18%, var(--surface-raised));
  color: var(--accent-soft);
}

.home-wizard-preview .is-current {
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 10%, transparent);
}

.home-handbook-preview {
  position: absolute;
  display: var(--home-preview-flex-display);
  right: 22px;
  bottom: 23px;
  width: 190px;
  flex-wrap: wrap;
  gap: 6px;
}

.home-handbook-preview div {
  width: 100%;
  height: 34px;
  display: flex;
  box-sizing: border-box;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  background: var(--surface-raised);
  color: var(--text-muted);
  font-size: 9px;
}

.home-handbook-preview > span {
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 7%, var(--surface));
  color: var(--text-2);
  font-size: 7px;
}

.home-session-preview {
  position: absolute;
  display: var(--home-preview-display);
  right: 28px;
  bottom: 28px;
  width: 190px;
  box-sizing: border-box;
  padding: 15px;
  border: 1px solid color-mix(in srgb, var(--accent) 26%, var(--border));
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  box-shadow: var(--shadow-md);
}

.home-session-preview small {
  color: var(--accent-soft);
  font-size: 7px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.home-session-route {
  display: flex;
  align-items: center;
  margin: 10px 0 13px;
}

.home-session-route span {
  width: 10px;
  height: 10px;
  flex: none;
  border: 2px solid var(--border-strong);
  border-radius: 50%;
  background: var(--surface-raised);
}

.home-session-route i {
  height: 1px;
  flex: 1;
  background: var(--border-strong);
}

.home-session-route .is-past {
  border-color: var(--accent);
  background: var(--accent);
}

.home-session-route .is-current {
  border-color: var(--accent-soft);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 12%, transparent);
}

.home-session-preview strong,
.home-session-preview p {
  display: block;
  margin: 0;
}

.home-session-preview strong {
  color: var(--text-1);
  font-size: 10px;
}

.home-session-preview p {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 8px;
}
</style>
