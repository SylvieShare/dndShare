<template>
  <div class="session-timer-control">
    <button
      ref="trigger"
      type="button"
      class="session-timer-trigger"
      :class="{
        'session-timer-trigger--active': activeCount > 0,
        'session-timer-trigger--completed': timers.completedCount.value > 0,
      }"
      :title="triggerTitle"
      :aria-label="triggerTitle"
      :aria-expanded="open"
      @click="open = !open"
    >
      <Timer :size="17" />
      <span v-if="activeCount" class="session-timer-badge">{{ activeCount }}</span>
    </button>

    <BasePopover v-model:open="open" :anchor="trigger" :min-width="350" placement="bottom-end" transition-preset="action-menu">
      <form class="session-timer-menu" @submit.prevent="submit">
        <header>
          <span class="session-timer-menu-icon"><TimerReset :size="18" /></span>
          <span><small>ТАЙМЕРЫ</small><strong>Новый отсчёт</strong></span>
        </header>

        <label class="session-timer-description">
          <span>Описание</span>
          <input v-model.trim="description" type="text" maxlength="160" autocomplete="off" placeholder="Например, до прибытия стражи" />
        </label>

        <fieldset>
          <legend>Длительность</legend>
          <div class="session-timer-duration">
            <label><input v-model.number="minutes" type="number" min="0" max="1440" inputmode="numeric" /><span>мин</span></label>
            <b>:</b>
            <label><input v-model.number="seconds" type="number" min="0" max="59" inputmode="numeric" /><span>сек</span></label>
          </div>
          <div class="session-timer-presets" aria-label="Быстрый выбор длительности">
            <button v-for="preset in presets" :key="preset.minutes" type="button" @click="setDuration(preset.minutes)">{{ preset.label }}</button>
          </div>
        </fieldset>

        <label class="session-timer-broadcast">
          <input v-model="broadcast" type="checkbox" />
          <MonitorUp :size="16" />
          <span><strong>Показывать в трансляции</strong><small>Только для этого таймера</small></span>
        </label>

        <button class="session-timer-submit" type="submit" :disabled="!canCreate || timers.creating.value">
          <Play :size="14" fill="currentColor" />
          {{ timers.creating.value ? 'Запускаем…' : 'Запустить таймер' }}
        </button>

        <div v-if="activeCount" class="session-timer-summary">
          <span><Layers3 :size="14" />{{ activeLabel }}</span>
          <small>Перетаскивайте окна за заголовок</small>
        </div>
        <p v-if="timers.error.value" class="session-timer-error" role="alert">{{ timers.error.value }}</p>
      </form>
    </BasePopover>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Layers3, MonitorUp, Play, Timer, TimerReset } from '@lucide/vue'
import { BasePopover } from '@sylvieshare/share-ui'

const props = defineProps({ timers: { type: Object, required: true } })
const trigger = ref(null)
const open = ref(false)
const description = ref('')
const minutes = ref(5)
const seconds = ref(0)
const broadcast = ref(false)
const presets = [
  { minutes: 1, label: '1 мин' },
  { minutes: 5, label: '5 мин' },
  { minutes: 10, label: '10 мин' },
  { minutes: 30, label: '30 мин' },
]
const activeCount = computed(() => props.timers.displayed.value.length)
const durationMs = computed(() => {
  const minuteValue = Math.max(0, Math.floor(Number(minutes.value) || 0))
  const secondValue = Math.max(0, Math.min(59, Math.floor(Number(seconds.value) || 0)))
  return (minuteValue * 60 + secondValue) * 1000
})
const canCreate = computed(() => description.value.trim().length > 0 && durationMs.value >= 5_000 && durationMs.value <= 86_400_000)
const triggerTitle = computed(() => {
  if (props.timers.completedCount.value) return `Таймеры · завершено: ${props.timers.completedCount.value}`
  return activeCount.value ? `Таймеры · активно: ${activeCount.value}` : 'Таймеры'
})
const activeLabel = computed(() => {
  const count = activeCount.value
  const lastTwo = count % 100
  const last = count % 10
  const noun = lastTwo !== 11 && last === 1
    ? 'таймер'
    : (lastTwo < 12 || lastTwo > 14) && last >= 2 && last <= 4 ? 'таймера' : 'таймеров'
  return `${count} ${noun} на экране`
})

function setDuration(value) {
  minutes.value = value
  seconds.value = 0
}

async function submit() {
  if (!canCreate.value || props.timers.creating.value) return
  try {
    await props.timers.create({ description: description.value.trim(), durationMs: durationMs.value, broadcast: broadcast.value })
    description.value = ''
    broadcast.value = false
  } catch { /* the composable exposes a localized error */ }
}
</script>

<style scoped>
.session-timer-control { display: contents; }
.session-timer-trigger {
  position: relative;
  width: 34px;
  height: 34px;
  display: inline-grid;
  place-items: center;
  padding: 0;
  border: 1px solid var(--border-strong);
  border-radius: 7px;
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  color: var(--text-2);
  cursor: pointer;
  transition: border-color .15s, background .15s, color .15s, box-shadow .15s;
}
.session-timer-trigger:hover,
.session-timer-trigger--active { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); background: color-mix(in srgb, var(--accent) 13%, transparent); color: var(--text-1); }
.session-timer-trigger--completed { border-color: color-mix(in srgb, var(--danger) 65%, var(--border)); background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); box-shadow: 0 0 14px color-mix(in srgb, var(--danger) 14%, transparent); }
.session-timer-badge { position: absolute; top: -5px; right: -5px; min-width: 16px; height: 16px; display: grid; place-items: center; padding: 0 4px; border: 2px solid var(--bg); border-radius: 9px; background: var(--accent); color: var(--text-on-accent); font-size: 8px; font-weight: 800; line-height: 1; }
.session-timer-trigger--completed .session-timer-badge { background: var(--danger); }
.session-timer-menu { width: 342px; display: flex; flex-direction: column; gap: 12px; padding: 7px; }
.session-timer-menu header { display: flex; align-items: center; gap: 9px; padding: 5px 3px 10px; border-bottom: 1px solid var(--border); }
.session-timer-menu header > span:last-child { display: flex; flex-direction: column; gap: 1px; }
.session-timer-menu header small, .session-timer-menu legend, .session-timer-description > span { color: var(--text-muted); font-size: 8px; font-weight: 800; letter-spacing: .11em; text-transform: uppercase; }
.session-timer-menu header strong { color: var(--text-1); font-size: 13px; }
.session-timer-menu-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent-soft); }
.session-timer-description { display: flex; flex-direction: column; gap: 5px; }
.session-timer-broadcast { display: grid; grid-template-columns: auto auto minmax(0, 1fr); align-items: center; gap: 8px; padding: 9px; border: 1px solid var(--border); border-radius: 8px; background: color-mix(in srgb, var(--accent) 5%, var(--surface-raised)); color: var(--text-2); cursor: pointer; }.session-timer-broadcast input { width: 15px; height: 15px; margin: 0; accent-color: var(--accent); }.session-timer-broadcast > span { display: flex; min-width: 0; flex-direction: column; gap: 1px; }.session-timer-broadcast strong { color: var(--text-1); font-size: 10px; }.session-timer-broadcast small { color: var(--text-muted); font-size: 8px; }
.session-timer-menu input { box-sizing: border-box; border: 1px solid var(--border); border-radius: 8px; outline: none; background: var(--surface); color: var(--text-1); font: inherit; transition: border-color .15s, box-shadow .15s; }
.session-timer-menu input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 14%, transparent); }
.session-timer-description input { width: 100%; padding: 9px 10px; font-size: 11px; }
.session-timer-menu fieldset { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; border: 0; }
.session-timer-menu legend { margin-bottom: 5px; }
.session-timer-duration { display: flex; align-items: center; gap: 7px; }
.session-timer-duration label { min-width: 0; flex: 1; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
.session-timer-duration label:focus-within { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 14%, transparent); }
.session-timer-duration input { min-width: 0; width: 100%; padding: 9px 3px 9px 10px; border: 0; background: transparent; box-shadow: none; font-size: 14px; font-weight: 750; }
.session-timer-duration input:focus { box-shadow: none; }
.session-timer-duration label span { padding-right: 9px; color: var(--text-muted); font-size: 9px; }
.session-timer-duration > b { color: var(--text-muted); font-size: 15px; }
.session-timer-presets { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; }
.session-timer-presets button { min-height: 28px; padding: 4px; border: 1px solid var(--border); border-radius: 7px; background: color-mix(in srgb, var(--text-on-accent) 3%, transparent); color: var(--text-2); cursor: pointer; font: inherit; font-size: 9px; font-weight: 700; }
.session-timer-presets button:hover { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); color: var(--text-1); }
.session-timer-submit { min-height: 36px; display: flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid var(--accent); border-radius: 8px; background: var(--accent); color: var(--text-on-accent); cursor: pointer; font: inherit; font-size: 11px; font-weight: 800; }
.session-timer-submit:disabled { cursor: default; opacity: .42; }
.session-timer-summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 9px; border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--border)); border-radius: 8px; background: color-mix(in srgb, var(--accent) 6%, transparent); }
.session-timer-summary span { display: flex; align-items: center; gap: 5px; color: var(--text-1); font-size: 9px; font-weight: 700; }
.session-timer-summary small { color: var(--text-muted); font-size: 8px; }
.session-timer-error { margin: -4px 2px 0; color: var(--danger); font-size: 9px; }
@media (prefers-reduced-motion: reduce) { .session-timer-trigger { transition: none; } }
</style>
