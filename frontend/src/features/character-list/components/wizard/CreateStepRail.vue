<template>
  <nav class="rail" :class="{ 'rail--with-action': showIncomplete }" aria-label="Шаги создания персонажа">
    <div class="rail-head">
      <div class="rail-caption">Создание</div>
      <button type="button" class="rail-reset" title="Начать создание сначала" @click="$emit('reset')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></svg>
        Сбросить
      </button>
    </div>
    <button
      v-for="(s, i) in steps"
      :key="s.key"
      class="rail-step"
      :class="{ active: i === current, done: i < current, ahead: i > current && i <= reachable, locked: i > reachable }"
      :disabled="i > reachable"
      :aria-current="i === current ? 'step' : undefined"
      @click="$emit('go', i)"
    >
      <span class="rail-badge">
        <svg v-if="i < current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6" /></svg>
        <template v-else>{{ i + 1 }}</template>
      </span>
      <span class="rail-copy">
        <span class="rail-title-row">
          <span class="rail-title">{{ s.title }}</span>
          <svg v-if="i > current && i <= reachable" class="rail-jump" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </span>
        <span v-if="s.summary" class="rail-summary">{{ s.summary }}</span>
      </span>
    </button>
    <button
      v-if="showIncomplete"
      type="button"
      class="rail-incomplete"
      :disabled="creating"
      title="Создать лист сейчас и заполнить недостающее позже"
      @click="$emit('create-incomplete')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke-dasharray="2.5 3" /><path d="M12 8v4l2.5 1.5" /></svg>
      {{ creating ? 'Создание…' : 'Создать неполноценного' }}
    </button>
  </nav>
</template>

<script setup>
defineProps({
  steps: { type: Array, required: true },
  current: { type: Number, default: 0 },
  reachable: { type: Number, default: 0 },
  showIncomplete: { type: Boolean, default: false },
  creating: { type: Boolean, default: false },
})
defineEmits(['go', 'reset', 'create-incomplete'])
</script>

<style scoped>
.rail {
  position: relative;
  display: flex; flex-direction: column; gap: 3px;
  padding: 8px;
  background: color-mix(in srgb, var(--surface) 74%, transparent);
  border: 1px solid color-mix(in srgb, var(--border-strong) 54%, transparent);
  border-radius: 14px;
}
.rail::before {
  content: '';
  position: absolute;
  top: 54px; bottom: 24px; left: 27px;
  width: 1px;
  background: color-mix(in srgb, var(--border-strong) 72%, transparent);
}
.rail--with-action::before { bottom: 66px; }
.rail-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 1px 3px 4px 10px; }
.rail-caption {
  padding: 2px 0 4px;
  font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  color: var(--text-muted);
}
.rail-reset {
  display: inline-flex; align-items: center; gap: 4px; padding: 5px 6px; border: 0; border-radius: 7px;
  background: transparent; color: var(--text-muted); font: inherit; font-size: 9px; font-weight: 650; cursor: pointer;
  transition: color .15s, background .15s;
}
.rail-reset:hover { color: var(--danger); background: color-mix(in srgb, var(--danger) 9%, transparent); }
.rail-reset:focus-visible, .rail-incomplete:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.rail-reset svg { width: 12px; height: 12px; }
.rail-step {
  position: relative;
  display: grid; grid-template-columns: 24px minmax(0, 1fr); align-items: start; gap: 11px;
  background: none; border: none; text-align: left;
  padding: 10px 9px; border-radius: 10px; cursor: pointer;
  font: inherit;
  transition: background 0.15s, opacity 0.15s;
}
.rail-step:disabled { cursor: default; }

/* ── State 1: locked / недоступен ── */
.rail-step.locked { opacity: 0.56; }

/* hover only for the clickable states */
.rail-step.done:hover,
.rail-step.ahead:hover { background: color-mix(in srgb, var(--text-on-accent) 4%, transparent); }

/* ── State 4: current / текущий ── */
.rail-step.active { background: color-mix(in srgb, var(--accent) 14%, var(--surface)); }

.rail-badge {
  flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums;
  color: var(--text-muted); background: var(--surface); box-shadow: inset 0 0 0 1px var(--border-strong);
  position: relative; z-index: 1;
}
.rail-badge svg { width: 13px; height: 13px; }
.rail-step.active .rail-badge { background: var(--accent); color: var(--text-on-accent); box-shadow: none; }

/* ── State 2: done / пройден (behind current) ── */
.rail-step.done .rail-badge { background: color-mix(in srgb, var(--accent) 30%, transparent); color: var(--accent-soft); box-shadow: none; }

/* ── State 3: ahead / можно вернуться вперёд (completed, past current) ── */
.rail-step.ahead .rail-badge { color: var(--accent); box-shadow: inset 0 0 0 1.5px var(--accent); }
.rail-step.ahead .rail-title { color: var(--text-2); }
.rail-jump { flex-shrink: 0; width: 13px; height: 13px; margin-left: auto; color: var(--accent); opacity: 0.55; }
.rail-step.ahead:hover .rail-jump { opacity: 1; }

.rail-copy { display: flex; min-width: 0; flex-direction: column; gap: 2px; padding-top: 2px; }
.rail-title-row { display: flex; min-width: 0; align-items: center; gap: 6px; }
.rail-title { min-width: 0; font-size: 13px; line-height: 1.2; color: var(--text-2); }
.rail-summary {
  display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 11px; line-height: 1.25; color: var(--text-muted);
}
.rail-step.active .rail-title { color: var(--text-1); font-weight: 500; }
.rail-step.active .rail-summary { color: var(--accent-soft); }
.rail-step.locked .rail-title { color: var(--text-muted); }
.rail-incomplete {
  position: relative; z-index: 1; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;
  margin-top: 5px; padding: 9px 7px 6px; border: 0; border-top: 1px solid color-mix(in srgb, var(--border-strong) 44%, transparent);
  background: transparent; color: var(--text-muted); font: inherit; font-size: 9px; line-height: 1.2; cursor: pointer;
  transition: color .15s;
}
.rail-incomplete:hover:not(:disabled) { color: var(--text-2); }
.rail-incomplete:disabled { opacity: .5; cursor: default; }
.rail-incomplete svg { width: 13px; height: 13px; }
</style>
