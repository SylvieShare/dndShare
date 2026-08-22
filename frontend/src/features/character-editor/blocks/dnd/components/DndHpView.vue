<template>
  <!-- Compact variant (toolbar / mobile strip) -->
  <div
    v-if="compact"
    class="hp-compact"
    :style="{ '--hp-color': barColor }"
    @click="$emit('open', $event)"
  >
    <div class="hp-c-header">
      <div class="hp-c-nums">
        <img class="hp-c-icon" :class="heartbeatClass" src="/static/hp-pulse.svg" :style="{ filter: svgColorFilter }" alt="" />
        <span class="hp-c-cur" :style="{ color: barColor }">{{ hpCurrent }}</span>
        <span class="hp-c-sep">/</span>
        <span class="hp-c-max">{{ hpMax }}</span>
        <span v-if="hpTemp > 0" class="hp-c-temp">+{{ hpTemp }}</span>
      </div>
    </div>
    <StatBar size="small" :percent="barPct" :color="barColor" :temp-percent="tempBarPct" temp-color="var(--info)" />
  </div>

  <!-- Main widget -->
  <div v-else class="hp-widget" :style="{ '--hp-color': barColor }">
    <div class="hp-content" :class="{ 'hp-dead': isDead }" @click="$emit('open', $event)">
      <div class="hp-top-row">
        <div class="hp-main">
          <img class="hp-heart-icon" :class="heartbeatClass" src="/static/hp-pulse.svg" :style="{ filter: svgColorFilter }" alt="" />
          <span class="hp-current" :style="{ color: barColor }">{{ hpCurrent }}</span>
          <div class="hp-sep">/</div>
          <span class="hp-max">{{ hpMax }}</span>
          <template v-if="hpTemp > 0">
            <div class="hp-temp-sep">+</div>
            <span class="hp-temp">{{ hpTemp }}</span>
          </template>
          <span v-if="hpStatus" class="hp-status-badge" :class="hpStatus.cls">{{ hpStatus.label }}</span>
        </div>
        <div class="hp-dice-row">
          <span class="hp-dice-label">Кости хитов</span>
          <span v-for="pool in hitDice" :key="pool.die" class="hp-dice-pool">
            <span class="hp-dice-count">{{ pool.total - pool.used }}/{{ pool.total }}</span>
            <SystemDie :sides="pool.die" :size="22" />
          </span>
        </div>
      </div>
      <StatBar size="large" decorated :percent="barPct" :color="barColor" :temp-percent="tempBarPct" temp-color="var(--info)" />
    </div>
    <DndDeathSaves :hp="hp" @click.stop @change="$emit('change', $event)" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import StatBar from '@/shared/ui/StatBar.vue'
import SystemDie from '@/shared/ui/SystemDie.vue'
import DndDeathSaves from '@/features/character-editor/blocks/dnd/DndDeathSaves'
import { normalizeHitDice } from '@/features/character-editor/blocks/dnd/lib/hitDice'
import { hpMaximum } from '@/features/character-editor/blocks/dnd/lib/hp'

const props = defineProps({
  hp: { type: Object, required: true },
  compact: { type: Boolean, default: false },
})
defineEmits(['open', 'change'])

const hpCurrent = computed(() => parseInt(props.hp.current) || 0)
const hpMax = computed(() => hpMaximum(props.hp))
const hpTemp = computed(() => parseInt(props.hp.temp) || 0)
const hitDice = computed(() => normalizeHitDice(props.hp))
const barPct = computed(() => {
  const max = hpMax.value
  if (max <= 0) return 0
  return Math.min(100, Math.max(0, (hpCurrent.value / max) * 100))
})
const tempBarPct = computed(() => {
  const max = hpMax.value
  if (max <= 0 || hpTemp.value <= 0) return 0
  return Math.min(100 - barPct.value, (hpTemp.value / max) * 100)
})
const barColor = computed(() => {
  const p = barPct.value
  if (p > 60) return 'var(--success)'
  if (p > 25) return 'var(--warning)'
  return 'var(--danger)'
})
const isDead = computed(() => hpCurrent.value <= 0)
const hpStatus = computed(() => {
  if (hpCurrent.value <= 0) return null
  const p = barPct.value
  if (p >= 100) return { label: 'Здоров', cls: 'status-full' }
  if (p > 75) return { label: 'Хорошо', cls: 'status-good' }
  if (p > 50) return { label: 'Ранен', cls: 'status-ok' }
  if (p > 25) return { label: 'Опасно', cls: 'status-warn' }
  return { label: 'Критически', cls: 'status-crit' }
})
const heartbeatClass = computed(() => {
  const p = barPct.value
  if (p > 50) return ''
  if (p > 25) return 'hb-medium'
  return 'hb-fast'
})
const svgColorFilter = computed(() => {
  const p = barPct.value
  if (p > 60) return 'invert(58%) sepia(40%) saturate(500%) hue-rotate(100deg) brightness(0.95)'
  if (p > 25) return 'invert(65%) sepia(60%) saturate(600%) hue-rotate(10deg) brightness(1.05)'
  return 'invert(30%) sepia(80%) saturate(700%) hue-rotate(330deg) brightness(0.9)'
})
</script>

<style scoped>
/* ── Compact variant ── */
.hp-compact { display: inline-flex; flex: 0 0 auto; flex-direction: column; gap: 4px; width: max-content; min-width: max-content; padding: 6px 8px; border-radius: 10px; transition: background 0.3s ease; cursor: pointer; }
.hp-c-header { display: flex; align-items: center; }
.hp-c-nums { display: flex; align-items: center; gap: 3px; min-width: max-content; white-space: nowrap; }
.hp-c-icon { width: 20px; height: 20px; flex-shrink: 0; transition: filter 0.3s ease; }
.hp-c-cur { font-size: 22px; font-weight: 800; line-height: 1; }
.hp-c-sep { color: var(--text-muted); font-size: 16px; font-weight: 600; margin: 0 2px; }
.hp-c-max { color: var(--text-2); font-size: 16px; font-weight: 600; line-height: 1; }
.hp-c-temp { color: var(--info); font-size: 13px; font-weight: 700; margin-left: 4px; line-height: 1; }

/* ── Main widget (frameless — the frame comes from the BaseTile/morph panel wrapper) ── */
.hp-widget {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 200px;
  padding: 14px 16px;
}
.hp-content { display: flex; flex-direction: column; gap: 8px; transition: opacity 0.4s ease; cursor: pointer; }
.hp-content.hp-dead { opacity: 0.18; filter: blur(4px); pointer-events: none; user-select: none; transition: opacity 0.4s ease, filter 0.4s ease; }
.hp-top-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.hp-main { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.hp-status-badge { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; border: 1px solid currentColor; opacity: 0.85; margin-left: 6px; align-self: center; transition: color 0.3s ease, border-color 0.3s ease; }
.status-full { color: var(--success); }
.status-good { color: var(--success); }
.status-ok { color: var(--warning); }
.status-warn { color: var(--danger); }
.status-crit { color: var(--danger); animation: hp-crit-pulse 1.4s ease-in-out infinite; }
@keyframes hp-crit-pulse { 0%, 100% { opacity: 0.85; } 50% { opacity: 0.45; } }
.hp-heart-icon { width: 26px; height: 26px; flex-shrink: 0; transition: filter 0.3s ease; align-self: center; margin-right: 2px; }
.hb-medium { animation: hp-heartbeat 1.7s ease-in-out infinite; }
.hb-fast { animation: hp-heartbeat 0.9s ease-in-out infinite; }
@keyframes hp-heartbeat { 0%, 100% { transform: scale(1); } 10% { transform: scale(1.25); } 20% { transform: scale(1); } 35% { transform: scale(1.12); } 50% { transform: scale(1); } }
.hp-current { font-size: 36px; font-weight: 800; min-width: 22px; text-align: center; line-height: 1; transition: color 0.3s ease; }
.hp-sep { color: var(--text-muted); font-size: 22px; font-weight: bold; line-height: 1; }
.hp-max { color: var(--text-2); font-size: 22px; font-weight: bold; min-width: 16px; text-align: center; line-height: 1; }
.hp-temp-sep { color: var(--text-muted); font-size: 16px; font-weight: bold; padding: 0 1px; }
.hp-temp { color: var(--info); font-size: 18px; font-weight: bold; min-width: 12px; text-align: center; line-height: 1; }
.hp-dice-row { display: flex; align-items: center; justify-content: flex-end; gap: 7px; flex-shrink: 0; flex-wrap: wrap; }
.hp-dice-label { color: var(--text-muted); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-right: 2px; }
.hp-dice-pool { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.hp-dice-count { color: var(--text-2); font-size: 14px; font-weight: 700; }
</style>
