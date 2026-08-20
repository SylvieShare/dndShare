<template>
  <TransitionGroup v-if="timers.displayed.value.length || timers.error.value" name="session-timer" tag="aside" class="session-timer-stack" aria-label="Таймеры сессии">
    <p v-if="timers.error.value" key="timer-error" class="session-timer-stack-error" role="alert">{{ timers.error.value }}</p>
    <article
      v-for="timer in timers.displayed.value"
      :key="timer.id"
      class="session-timer-card"
      :class="{ 'session-timer-card--paused': timer.paused, 'session-timer-card--completed': timer.completed }"
      :style="{ '--timer-progress': `${Math.round(timer.progress * 100)}%` }"
    >
      <div class="session-timer-card-head">
        <span class="session-timer-card-icon"><BellRing v-if="timer.completed" :size="15" /><Timer v-else :size="15" /></span>
        <strong>{{ timer.description }}</strong>
        <span v-if="timer.broadcast" class="session-timer-live" title="Показывается в трансляции"><MonitorUp :size="13" /></span>
        <button v-if="!timer.completed" type="button" class="session-timer-dismiss" title="Отменить таймер" aria-label="Отменить таймер" :disabled="timers.isPending(timer.id)" @click="run(() => timers.remove(timer.id))"><X :size="14" /></button>
      </div>

      <div class="session-timer-readout">
        <time>{{ formatTimerDuration(timer.remainingMs) }}</time>
        <span v-if="timer.completed">Время вышло</span>
        <span v-else-if="timer.paused">На паузе</span>
        <span v-else>Осталось</span>
      </div>

      <div class="session-timer-progress" aria-hidden="true"><span /></div>

      <div class="session-timer-actions">
        <button v-if="timer.completed" type="button" class="session-timer-remove" :disabled="timers.isPending(timer.id)" @click="run(() => timers.remove(timer.id))"><Trash2 :size="13" />Убрать</button>
        <button v-else type="button" :disabled="timers.isPending(timer.id)" @click="run(() => timer.paused ? timers.resume(timer.id) : timers.pause(timer.id))">
          <Play v-if="timer.paused" :size="13" fill="currentColor" /><Pause v-else :size="13" fill="currentColor" />
          {{ timer.paused ? 'Продолжить' : 'Пауза' }}
        </button>
        <span class="session-timer-actions-spacer" />
        <button v-if="!timer.completed" type="button" :disabled="timers.isPending(timer.id)" @click="run(() => timers.subtractTime(timer.id, 300_000))">−5 мин</button>
        <button v-if="!timer.completed" type="button" :disabled="timers.isPending(timer.id)" @click="run(() => timers.subtractTime(timer.id, 60_000))">−1 мин</button>
        <button type="button" :disabled="timers.isPending(timer.id)" @click="run(() => timers.addTime(timer.id, 60_000))">+1 мин</button>
        <button type="button" :disabled="timers.isPending(timer.id)" @click="run(() => timers.addTime(timer.id, 300_000))">+5 мин</button>
      </div>
    </article>
  </TransitionGroup>
</template>

<script setup>
import { BellRing, MonitorUp, Pause, Play, Timer, Trash2, X } from '@lucide/vue'
import { formatTimerDuration } from '@/features/sessions/lib/sessionTimers'

const props = defineProps({ timers: { type: Object, required: true } })
async function run(action) { await action().catch(() => {}) }
</script>

<style scoped>
.session-timer-stack {
  position: absolute;
  z-index: 18;
  top: 70px;
  right: 14px;
  width: 290px;
  max-height: calc(100% - 84px);
  display: flex;
  flex-direction: column;
  gap: 9px;
  overflow-y: auto;
  pointer-events: none;
  scrollbar-width: thin;
  transition: right .28s cubic-bezier(.22, 1, .36, 1);
}
.session-timer-card {
  position: relative;
  flex: none;
  overflow: hidden;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  border-radius: 12px;
  background: color-mix(in srgb, var(--popover-bg) 91%, transparent);
  box-shadow: var(--shadow-lg);
  color: var(--text-1);
  pointer-events: auto;
  backdrop-filter: blur(15px) saturate(1.12);
  -webkit-backdrop-filter: blur(15px) saturate(1.12);
  transition: border-color .2s, background .2s, box-shadow .2s;
}
.session-timer-stack-error { margin: 0; padding: 9px 11px; border: 1px solid color-mix(in srgb, var(--danger) 45%, var(--border)); border-radius: 9px; background: var(--popover-bg); color: var(--danger); box-shadow: var(--shadow-md); font-size: 9px; pointer-events: auto; }
.session-timer-card::before { position: absolute; top: 0; right: 0; left: 0; height: 2px; background: var(--accent); content: ''; opacity: .72; }
.session-timer-card--paused { border-color: color-mix(in srgb, var(--warning) 38%, var(--border)); }
.session-timer-card--paused::before { background: var(--warning); }
.session-timer-card--completed { border-color: color-mix(in srgb, var(--danger) 62%, var(--border)); background: color-mix(in srgb, var(--danger) 9%, var(--popover-bg)); box-shadow: 0 10px 34px color-mix(in srgb, var(--danger) 17%, transparent); animation: session-timer-completed 1.4s ease-in-out 2; }
.session-timer-card--completed::before { background: var(--danger); opacity: 1; }
.session-timer-card-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 8px; }
.session-timer-live { width: 24px; height: 24px; display: grid; place-items: center; border-radius: 7px; background: color-mix(in srgb, var(--success) 13%, transparent); color: var(--success); }
.session-timer-card-icon { width: 27px; height: 27px; display: grid; place-items: center; border-radius: 8px; background: color-mix(in srgb, var(--accent) 13%, transparent); color: var(--accent-soft); }
.session-timer-card--paused .session-timer-card-icon { background: color-mix(in srgb, var(--warning) 12%, transparent); color: var(--warning); }
.session-timer-card--completed .session-timer-card-icon { background: color-mix(in srgb, var(--danger) 15%, transparent); color: var(--danger); }
.session-timer-card-head strong { overflow: hidden; font-size: 11px; font-weight: 750; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
.session-timer-dismiss { width: 25px; height: 25px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--text-muted); cursor: pointer; }
.session-timer-dismiss:hover { background: color-mix(in srgb, var(--danger) 10%, transparent); color: var(--danger); }
.session-timer-readout { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 10px 1px 7px; }
.session-timer-readout time { font-family: var(--font-ui); font-size: 27px; font-weight: 750; letter-spacing: .045em; line-height: 1; font-variant-numeric: tabular-nums; }
.session-timer-readout span { color: var(--text-muted); font-size: 8px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.session-timer-card--paused .session-timer-readout span { color: var(--warning); }
.session-timer-card--completed .session-timer-readout time, .session-timer-card--completed .session-timer-readout span { color: var(--danger); }
.session-timer-progress { height: 3px; overflow: hidden; border-radius: 3px; background: color-mix(in srgb, var(--text-muted) 15%, transparent); }
.session-timer-progress span { display: block; width: var(--timer-progress); height: 100%; border-radius: inherit; background: var(--accent); transition: width .25s linear; }
.session-timer-card--paused .session-timer-progress span { background: var(--warning); }
.session-timer-card--completed .session-timer-progress span { background: var(--danger); }
.session-timer-actions { display: flex; align-items: center; gap: 5px; margin-top: 10px; }
.session-timer-actions button { min-height: 27px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 4px 7px; border: 1px solid var(--border); border-radius: 7px; background: color-mix(in srgb, var(--text-on-accent) 4%, transparent); color: var(--text-2); cursor: pointer; font: inherit; font-size: 8px; font-weight: 750; }
.session-timer-actions button:hover:not(:disabled) { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); color: var(--text-1); }
.session-timer-actions button:disabled, .session-timer-dismiss:disabled { cursor: default; opacity: .42; }
.session-timer-actions-spacer { flex: 1; }
.session-timer-actions .session-timer-remove { border-color: color-mix(in srgb, var(--danger) 48%, var(--border)); background: color-mix(in srgb, var(--danger) 12%, transparent); color: var(--danger); }
.session-timer-enter-active, .session-timer-leave-active { transition: opacity .2s, transform .24s cubic-bezier(.22, 1, .36, 1); }
.session-timer-enter-from, .session-timer-leave-to { opacity: 0; transform: translateX(18px) scale(.97); }
.session-timer-move { transition: transform .24s cubic-bezier(.22, 1, .36, 1); }
@keyframes session-timer-completed { 50% { box-shadow: 0 10px 38px color-mix(in srgb, var(--danger) 26%, transparent); } }
@media (prefers-reduced-motion: reduce) {
  .session-timer-stack, .session-timer-card, .session-timer-progress span, .session-timer-enter-active, .session-timer-leave-active, .session-timer-move { transition: none; }
  .session-timer-card--completed { animation: none; }
}
@media (max-width: 760px) { .session-timer-stack { top: 126px; right: 10px; width: min(290px, calc(100% - 20px)); } }
</style>
