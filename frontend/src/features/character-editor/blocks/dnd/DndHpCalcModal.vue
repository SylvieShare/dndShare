<template>
  <AppModal @close="$emit('close')">

    <!-- HP summary -->
    <div class="hc-summary" :class="{ 'hc-summary-dead': isDead }" :style="summaryStyle">
      <div class="hc-summary-content" :class="{ 'hc-dead': isDead }">
        <div class="hc-nums">
          <img class="hc-pulse-icon" :class="heartbeatClass" src="/static/hp-pulse.svg" :style="{ filter: svgColorFilter }" alt="" />
          <span class="hc-current" :style="{ color: barColor }">{{ hpCurrent }}</span>
          <span class="hc-sep">/</span>
          <span class="hc-max">{{ hpMax }}</span>
          <span v-if="hpTemp > 0" class="hc-temp">+{{ hpTemp }}</span>
        </div>
        <div class="hc-bar-wrap">
          <div class="hc-bar" :style="{ width: barPct + '%', backgroundColor: barColor }"></div>
        </div>
      </div>
      <DndDeathSaves v-if="!isNpc" :hp="hp" @change="$emit('change', $event)" />
      <div v-else-if="isDead" class="hc-graveyard-overlay" @click.stop>
        <span class="hc-skull">💀</span>
        <button type="button" class="hc-graveyard-btn" @click="$emit('graveyard')">
          На кладбище
        </button>
      </div>
    </div>

    <CalcPad v-model="calcAmount" />

    <div class="hc-actions">
      <button class="hc-btn hc-dmg"  @click="applyCalc('damage')">Урон</button>
      <button class="hc-btn hc-heal" @click="applyCalc('heal')">Лечение</button>
      <button class="hc-btn hc-temp" @click="applyCalc('temp')">+Врем</button>
    </div>

    <!-- Hit dice -->
    <div class="hc-dice-section">
      <span class="hc-dice-label">Кости хитов</span>
      <div class="hc-dice-controls">
        <button class="hc-dice-btn" :disabled="diceUsed >= hp.diceCount" @click="adjustDice(1)">−</button>
        <div class="hc-dice-val">
          <span>{{ diceRemaining }}/{{ hp.diceCount || 1 }}</span>
          <span v-if="diceSvg" class="hc-dice-svg" v-html="diceSvg" />
          <span v-else>{{ hp.dice || 'd8' }}</span>
        </div>
        <button class="hc-dice-btn" :disabled="diceUsed <= 0" @click="adjustDice(-1)">+</button>
      </div>
    </div>

  </AppModal>
</template>

<script setup>
import { computed, ref } from 'vue'
import CalcPad from '@/features/character-editor/components/CalcPad'
import AppModal from '@/shared/ui/AppModal'
import DndDeathSaves from './DndDeathSaves'

const props = defineProps({
  hp:          { type: Object, required: true },
  diceOptions: { type: Array, default: () => [] },
  isNpc:       { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'change', 'graveyard'])
const calcAmount = ref('')
const hpCurrent = computed(() => parseInt(props.hp.current) || 0)
const isDead = computed(() => hpCurrent.value <= 0)
const hpMax = computed(() => parseInt(props.hp.max) || 0)
const hpTemp = computed(() => parseInt(props.hp.temp) || 0)
const diceUsed = computed(() => Math.max(0, Math.min(props.hp.diceCount || 1, parseInt(props.hp.diceUsed) || 0)))
const diceRemaining = computed(() => Math.max(0, (parseInt(props.hp.diceCount) || 1) - diceUsed.value))
const barPct = computed(() => {
  const max = hpMax.value
  if (max <= 0) return 0
  return Math.min(100, Math.max(0, (hpCurrent.value / max) * 100))
})
const heartbeatClass = computed(() => {
  const p = barPct.value
  if (p > 50) return ''
  if (p > 25) return 'hb-medium'
  return 'hb-fast'
})
const summaryStyle = computed(() => {
  const p = barPct.value
  if (p > 50) return {}
  const t = (50 - p) / 50
  return {
    boxShadow: `0 0 0 1px color-mix(in srgb, var(--danger) ${Math.round(t * 50)}%, transparent), 0 0 ${Math.round(t * 16)}px color-mix(in srgb, var(--danger) ${Math.round(t * 25)}%, transparent)`,
  }
})
const barColor = computed(() => {
  const p = barPct.value
  if (p > 60) return 'var(--success)'
  if (p > 25) return 'var(--warning)'
  return 'var(--danger)'
})
const svgColorFilter = computed(() => {
  const p = barPct.value
  if (p > 60) return 'invert(58%) sepia(40%) saturate(500%) hue-rotate(100deg) brightness(0.95)'
  if (p > 25) return 'invert(65%) sepia(60%) saturate(600%) hue-rotate(10deg) brightness(1.05)'
  return 'invert(30%) sepia(80%) saturate(700%) hue-rotate(330deg) brightness(0.9)'
})
const diceSvg = computed(() => {
  const current = props.hp.dice || 'd8'
  const opt = props.diceOptions.find(o => o.value === current)
  return opt?.svg || null
})

function evalExpr(expr) {
  const clean = String(expr).replace(/−/g, '-').replace(/[^0-9+\-*/\s.]/g, '')
  if (!clean.trim()) return 0
  try {
    // eslint-disable-next-line no-new-func
    return Math.abs(Math.round(new Function('return (' + clean + ')')()))  || 0
  } catch { return 0 }
}

function applyCalc(type) {
  const amount = evalExpr(calcAmount.value)
  if (!amount) return
  const hp = { ...props.hp }
  if (type === 'damage') {
    const temp = parseInt(hp.temp) || 0
    const absorbed = Math.min(temp, amount)
    hp.temp = temp - absorbed
    hp.current = Math.max(0, (parseInt(hp.current) || 0) - (amount - absorbed))
  } else if (type === 'heal') {
    hp.current = Math.min(parseInt(hp.max) || 0, (parseInt(hp.current) || 0) + amount)
  } else if (type === 'temp') {
    hp.temp = (parseInt(hp.temp) || 0) + amount
  }
  emit('change', hp)
  calcAmount.value = ''
}

function adjustDice(delta) {
  const used = Math.max(0, Math.min((props.hp.diceCount || 1), diceUsed.value + delta))
  emit('change', { ...props.hp, diceUsed: used })
}
</script>

<style scoped>
.hc-summary {
  position: relative;
  border: 1px solid color-mix(in srgb, var(--text-muted) 18%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-on-accent) 3.5%, transparent);
  overflow: hidden;
  transition: box-shadow 0.3s ease;
}

.hc-summary-dead {
  animation: hc-dead-pulse 2s ease-in-out infinite;
}

@keyframes hc-dead-pulse {
  0%, 100% { box-shadow: 0 0 0 1px color-mix(in srgb, var(--danger) 45%, transparent), 0 0 14px color-mix(in srgb, var(--danger) 22%, transparent); }
  50%       { box-shadow: 0 0 0 2px color-mix(in srgb, var(--danger) 70%, transparent),  0 0 28px color-mix(in srgb, var(--danger) 38%, transparent); }
}

.hb-medium { animation: hc-heartbeat 1.7s ease-in-out infinite; }
.hb-fast   { animation: hc-heartbeat 0.9s ease-in-out infinite; }

@keyframes hc-heartbeat {
  0%, 100% { transform: scale(1); }
  10%       { transform: scale(1.25); }
  20%       { transform: scale(1); }
  35%       { transform: scale(1.12); }
  50%       { transform: scale(1); }
}

.hc-summary-content {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 8px 10px;
  transition: filter 0.35s ease, opacity 0.35s ease;
}

.hc-summary-content.hc-dead {
  filter: blur(3px);
  opacity: 0.15;
  pointer-events: none;
  user-select: none;
}

.hc-nums {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.hc-pulse-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  transition: filter 0.3s ease;
  margin-right: 2px;
}

.hc-current { font-size: 28px; font-weight: 800; line-height: 1; }
.hc-sep     { color: var(--text-muted); font-size: 18px; font-weight: 700; }
.hc-max     { color: var(--text-2); font-size: 18px; font-weight: 700; }
.hc-temp    { margin-left: 4px; color: var(--info); font-size: 15px; font-weight: 800; }

.hc-bar-wrap {
  height: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--bg);
}

.hc-bar {
  height: 100%;
  border-radius: 999px;
  transition: width 0.2s ease, background-color 0.2s ease;
}

.hc-actions { display: flex; gap: 6px; }

.hc-btn {
  flex: 1;
  border: none;
  border-radius: 8px;
  padding: 18px 4px;
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  touch-action: manipulation;
  transition: opacity 0.12s;
  background: color-mix(in srgb, var(--info) 25%, transparent);
}
.hc-btn:hover { opacity: 0.85; }

.hc-dmg  { background: color-mix(in srgb, var(--danger) 25%, transparent);  color: var(--danger); }
.hc-heal { background: color-mix(in srgb, var(--success) 25%, transparent); color: var(--success); }
.hc-temp { color: var(--info); }

/* Hit dice */
.hc-dice-section {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 4px;
  border-top: 1px solid var(--border);
}

.hc-dice-label {
  color: var(--text-muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex: 1;
}

.hc-dice-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hc-dice-val {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--text-2);
  font-size: 14px;
  font-weight: 700;
  min-width: 60px;
  justify-content: center;
}

.hc-dice-svg {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
  flex-shrink: 0;
}
.hc-dice-svg :deep(svg) {
  width: 22px;
  height: 22px;
}

.hc-dice-btn {
  background: color-mix(in srgb, var(--text-on-accent) 5%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 10%, transparent);
  border-radius: 6px;
  color: var(--text-muted);
  font-size: 16px;
  font-weight: 700;
  width: 30px;
  height: 30px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s, color 0.1s;
  touch-action: manipulation;
}
.hc-dice-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--text-on-accent) 12%, transparent); color: var(--text-1); }
.hc-dice-btn:disabled { opacity: 0.25; cursor: not-allowed; }

.hc-graveyard-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: color-mix(in srgb, var(--surface, var(--bg)) 60%, transparent);
  border-radius: inherit;
  z-index: 1;
}
.hc-skull {
  font-size: 28px;
  line-height: 1;
  filter: drop-shadow(0 0 8px color-mix(in srgb, var(--danger) 45%, transparent));
}
.hc-graveyard-btn {
  background: color-mix(in srgb, var(--danger) 18%, transparent);
  color: var(--danger);
  border: 1px solid color-mix(in srgb, var(--danger) 45%, transparent);
  border-radius: 8px;
  padding: 8px 16px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.hc-graveyard-btn:hover { background: color-mix(in srgb, var(--danger) 32%, transparent); border-color: color-mix(in srgb, var(--danger) 70%, transparent); }
</style>
