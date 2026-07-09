<template>
  <!-- compact -->
  <div v-if="compact" class="lvl-compact" @click="$emit('open', $event)">
    <div class="lvl-compact-bar-wrap" :class="{ 'lvl-compact-levelup': canLevelUp }">
      <div class="lvl-compact-bar" :style="{ width: barPct + '%' }"></div>
      <div class="lvl-compact-content">
        <span class="lvl-compact-label">уровень</span>
        <span class="lvl-compact-level">{{ level }}</span>
        <span v-if="canLevelUp" class="lvl-compact-up">↑</span>
      </div>
    </div>
  </div>

  <!-- mini (toolbar) -->
  <div v-else-if="mini" class="cmini" :class="{ 'cmini-levelup': canLevelUp }" @click="$emit('open', $event)">
    <span class="cmini-label">УР.</span>
    <span class="cmini-value">{{ level }}<span v-if="canLevelUp" class="cmini-up">↑</span></span>
    <div class="cmini-bar" :style="{ width: barPct + '%' }"></div>
  </div>

  <!-- widget -->
  <div v-else class="lvl-widget" @click="$emit('open', $event)">
    <div class="lvl-w-level">
      <div class="lvl-w-sup">УР.</div>
      <span class="lvl-w-num">{{ level }}</span>
    </div>
    <div class="lvl-w-center">
      <div class="lvl-w-xp-row">
        <span v-if="nextLevelExp !== null" class="lvl-w-xp-nums">{{ data.exp }} / {{ nextLevelExp }}</span>
        <span v-else class="lvl-w-xp-max">Макс. уровень</span>
      </div>
      <StatBar size="medium" decorated :percent="barPct" color="var(--accent)" />
    </div>
    <span v-if="canLevelUp" class="lvl-w-up">↑</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import StatBar from '@/shared/ui/StatBar.vue'

const EXPERIENCE = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000,
  48000, 64000, 85000, 100000, 120000, 140000, 165000,
  195000, 225000, 265000, 305000, 355000,
]

const props = defineProps({
  data: { type: Object, default: () => ({ level: 1, exp: 0 }) },
  compact: { type: Boolean, default: false },
  mini: { type: Boolean, default: false },
})
defineEmits(['open'])

const level = computed(() => Math.max(1, Math.min(20, parseInt(props.data.level) || 1)))
const currentLevelExp = computed(() => EXPERIENCE[level.value - 1])
const nextLevelExp = computed(() => (level.value < 20 ? EXPERIENCE[level.value] : null))
const barPct = computed(() => {
  const exp = parseInt(props.data.exp) || 0
  const from = currentLevelExp.value
  const to = nextLevelExp.value
  if (to === null) return 100
  return Math.min(100, Math.max(0, ((exp - from) / (to - from)) * 100))
})
const canLevelUp = computed(() => {
  if (level.value >= 20 || nextLevelExp.value === null) return false
  return (parseInt(props.data.exp) || 0) >= nextLevelExp.value
})
</script>

<style scoped>
/* ── Compact ── */
.lvl-compact { flex: 1; min-width: 0; cursor: pointer; }
.lvl-compact-bar-wrap {
  position: relative;
  height: 24px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-deep);
  border: 1px solid var(--border);
  transition: border-color 0.15s;
}
.lvl-compact:hover .lvl-compact-bar-wrap { border-color: var(--border-strong); }
.lvl-compact-bar { position: absolute; top: 0; left: 0; bottom: 0; width: 0; border-radius: 8px; background-color: var(--accent); transition: width 0.3s ease; opacity: 0.38; }
.lvl-compact-content { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 4px; }
.lvl-compact-label { color: var(--text-muted); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.lvl-compact-level { color: var(--text-1); font-size: 13px; font-weight: 800; line-height: 1; }
.lvl-compact-up { color: var(--accent); font-size: 13px; font-weight: 900; line-height: 1; animation: lvl-pulse 2s ease-in-out infinite; }
.lvl-compact-levelup { border-color: color-mix(in srgb, var(--accent) 35%, transparent); }

/* ── Mini ── */
.cmini { flex: 1; min-width: 0; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; min-height: 40px; padding: 4px 6px; cursor: pointer; box-sizing: border-box; }
.cmini-label { font-size: 9px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; line-height: 1; }
.cmini-value { font-size: 18px; font-weight: 700; color: var(--text-1); line-height: 1; }
.cmini-up { color: var(--accent); font-size: 12px; font-weight: 900; }
.cmini-bar { position: absolute; left: 6px; right: 6px; bottom: 3px; height: 2px; border-radius: 2px; background: var(--accent); opacity: 0.5; }

/* ── Widget ── */
.lvl-widget { display: flex; align-items: center; gap: 16px; padding: 12px 14px; cursor: pointer; }
.lvl-w-level { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
.lvl-w-sup { color: var(--text-muted); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
.lvl-w-num { color: var(--text-1); font-size: 30px; font-weight: 800; line-height: 1; }
.lvl-w-center { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.lvl-w-xp-row { display: flex; align-items: baseline; }
.lvl-w-xp-nums { color: var(--text-2); font-size: 13px; font-weight: 600; }
.lvl-w-xp-max { color: var(--text-muted); font-size: 12px; }
.lvl-w-up { color: var(--accent); font-size: 18px; font-weight: 900; flex-shrink: 0; animation: lvl-pulse 2s ease-in-out infinite; }

@keyframes lvl-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
</style>
