<template>
  <EditorPanel compact>
    <!-- Heal / damage / temp -->
    <CalcPad v-model="calcAmount" />
    <div class="hpe-actions">
      <button class="hpe-btn hpe-dmg" type="button" @click="applyCalc('damage')">Урон</button>
      <button class="hpe-btn hpe-heal" type="button" @click="applyCalc('heal')">Лечение</button>
      <button class="hpe-btn hpe-temp" type="button" @click="applyCalc('temp')">+Врем</button>
    </div>

    <!-- Hit dice usage -->
    <div class="hpe-dice-section">
      <span class="hpe-dice-label">Кости хитов</span>
      <div class="hpe-dice-controls">
        <button class="hpe-dice-btn" type="button" :disabled="diceUsed >= (hp.diceCount || 1)" @click="adjustDice(1)">−</button>
        <div class="hpe-dice-val">
          <span>{{ diceRemaining }}/{{ hp.diceCount || 1 }}</span>
          <span v-if="diceSvg" class="hpe-dice-svg" v-html="diceSvg" />
          <span v-else>{{ hp.dice || 'd8' }}</span>
        </div>
        <button class="hpe-dice-btn" type="button" :disabled="diceUsed <= 0" @click="adjustDice(-1)">+</button>
      </div>
    </div>

    <!-- Max / dice config -->
    <FormField label="Максимум HP">
      <FormNumberInput :value="hp.max || 0" :min="0" :max="999" @change="set('max', $event)" />
    </FormField>
    <FormField label="Костей хитов">
      <FormNumberInput :value="hp.diceCount || 1" :min="1" :max="99" @change="set('diceCount', $event)" />
    </FormField>
    <div class="hpe-field">
      <span class="hpe-label">Тип кубика</span>
      <div class="hpe-pills">
        <button
          v-for="opt in diceOptions"
          :key="opt.value"
          class="hpe-pill"
          :class="{ active: (hp.dice || 'd8') === opt.value, 'hpe-pill-svg': opt.svg }"
          :title="opt.value"
          type="button"
          @click="set('dice', opt.value)"
        >
          <SvgIcon v-if="opt.svg" class="hpe-pill-img" :svg="opt.svg" />
          <span v-else>{{ opt.value }}</span>
        </button>
      </div>
    </div>
  </EditorPanel>
</template>

<script setup>
import { computed, ref } from 'vue'
import CalcPad from '@/features/character-editor/components/CalcPad'
import EditorPanel from '@/features/character-editor/components/EditorPanel'
import FormField from '@/shared/ui/form/FormField'
import FormNumberInput from '@/shared/ui/form/FormNumberInput'
import SvgIcon from '@/shared/ui/SvgIcon'

const props = defineProps({
  hp: { type: Object, required: true },
  diceOptions: { type: Array, default: () => [] },
})
const emit = defineEmits(['change'])
const calcAmount = ref('')

const diceUsed = computed(() => Math.max(0, Math.min(props.hp.diceCount || 1, parseInt(props.hp.diceUsed) || 0)))
const diceRemaining = computed(() => Math.max(0, (parseInt(props.hp.diceCount) || 1) - diceUsed.value))
const diceSvg = computed(() => {
  const current = props.hp.dice || 'd8'
  return props.diceOptions.find(o => o.value === current)?.svg || null
})

function evalExpr(expr) {
  const clean = String(expr).replace(/−/g, '-').replace(/[^0-9+\-*/\s.]/g, '')
  if (!clean.trim()) return 0
  try {
    // eslint-disable-next-line no-new-func
    return Math.abs(Math.round(new Function('return (' + clean + ')')())) || 0
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
function set(field, value) { emit('change', { ...props.hp, [field]: value }) }
</script>

<style scoped>
.hpe-actions { display: flex; gap: 6px; }
.hpe-btn {
  flex: 1;
  border: none;
  border-radius: 8px;
  padding: 16px 4px;
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  touch-action: manipulation;
  transition: opacity 0.12s;
  background: rgba(90, 140, 220, 0.25);
}
.hpe-btn:hover { opacity: 0.85; }
.hpe-dmg { background: rgba(200, 60, 60, 0.25); color: #e07070; }
.hpe-heal { background: rgba(60, 175, 110, 0.25); color: #5aaf72; }
.hpe-temp { color: #7ab8e8; }

.hpe-dice-section {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
}
.hpe-dice-label { color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; flex: 1; }
.hpe-dice-controls { display: flex; align-items: center; gap: 8px; }
.hpe-dice-val { display: flex; align-items: center; gap: 5px; color: var(--text-2); font-size: 14px; font-weight: 700; min-width: 60px; justify-content: center; }
.hpe-dice-svg { width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; opacity: 0.8; flex-shrink: 0; }
.hpe-dice-svg :deep(svg) { width: 22px; height: 22px; }
.hpe-dice-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
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
.hpe-dice-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.12); color: var(--text-1); }
.hpe-dice-btn:disabled { opacity: 0.25; cursor: not-allowed; }

.hpe-field { display: flex; flex-direction: column; gap: 8px; }
.hpe-label { color: var(--text-muted); font-size: 13px; }
.hpe-pills { display: flex; flex-wrap: wrap; gap: 6px; }
.hpe-pill {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #3a3a46;
  border-radius: 7px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  padding: 5px 12px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
  touch-action: manipulation;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hpe-pill-svg { padding: 4px; width: 36px; height: 36px; }
.hpe-pill-img { width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; opacity: 0.55; transition: opacity 0.12s; flex-shrink: 0; }
.hpe-pill:hover { background: rgba(255, 255, 255, 0.09); color: var(--text-2); }
.hpe-pill:hover .hpe-pill-img { opacity: 0.8; }
.hpe-pill.active { background: color-mix(in srgb, var(--accent) 25%, transparent); border-color: var(--accent); color: var(--color-attack); }
.hpe-pill.active .hpe-pill-img { opacity: 1; }
</style>
