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
      <div v-for="pool in hitDice" :key="pool.die" class="hpe-dice-row">
        <div class="hpe-dice-controls">
          <button class="hpe-dice-btn" type="button" :disabled="pool.used >= pool.total" @click="adjustDice(pool, 1)">−</button>
          <div class="hpe-dice-val">
            <span>{{ pool.total - pool.used }}/{{ pool.total }}</span>
            <span v-if="diceSvg(pool.die)" class="hpe-dice-svg" v-html="diceSvg(pool.die)" />
            <span v-else>{{ pool.die }}</span>
          </div>
          <button class="hpe-dice-btn" type="button" :disabled="pool.used <= 0" @click="adjustDice(pool, -1)">+</button>
        </div>
      </div>
    </div>

    <!-- Max / dice config -->
    <FormField label="Максимум HP">
      <FormNumberInput :value="hp.max || 0" :min="0" :max="999" @change="set('max', $event)" />
    </FormField>
    <div v-if="hitDice.length === 1" class="hpe-field">
      <span class="hpe-label">Тип кубика</span>
      <div class="hpe-pills">
        <button
          v-for="opt in diceOptions"
          :key="opt.value"
          class="hpe-pill"
          :class="{ active: hitDice[0].die === opt.value, 'hpe-pill-svg': opt.svg }"
          :title="opt.value"
          type="button"
          @click="setDie(opt.value)"
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
import {
  changeHitDieType,
  normalizeHitDice,
  setHitDieUsed,
} from '@/features/character-editor/blocks/dnd/lib/hitDice'

const props = defineProps({
  hp: { type: Object, required: true },
  diceOptions: { type: Array, default: () => [] },
})
const emit = defineEmits(['change'])
const calcAmount = ref('')

const hitDice = computed(() => normalizeHitDice(props.hp))
function diceSvg(die) { return props.diceOptions.find(o => o.value === die)?.svg || null }

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

function adjustDice(pool, delta) {
  emit('change', setHitDieUsed(props.hp, pool.die, pool.used + delta))
}
function setDie(die) { emit('change', changeHitDieType(props.hp, hitDice.value[0].die, die)) }
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
  background: color-mix(in srgb, var(--info) 25%, transparent);
}
.hpe-btn:hover { opacity: 0.85; }
.hpe-dmg { background: color-mix(in srgb, var(--danger) 25%, transparent); color: var(--danger); }
.hpe-heal { background: color-mix(in srgb, var(--success) 25%, transparent); color: var(--success); }
.hpe-temp { color: var(--info); }

.hpe-dice-section {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
}
.hpe-dice-label { color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
.hpe-dice-row { display: flex; justify-content: flex-end; }
.hpe-dice-controls { display: flex; align-items: center; gap: 8px; }
.hpe-dice-val { display: flex; align-items: center; gap: 5px; color: var(--text-2); font-size: 14px; font-weight: 700; min-width: 60px; justify-content: center; }
.hpe-dice-svg { width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; opacity: 0.8; flex-shrink: 0; }
.hpe-dice-svg :deep(svg) { width: 22px; height: 22px; }
.hpe-dice-btn {
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
.hpe-dice-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--text-on-accent) 12%, transparent); color: var(--text-1); }
.hpe-dice-btn:disabled { opacity: 0.25; cursor: not-allowed; }

.hpe-field { display: flex; flex-direction: column; gap: 8px; }
.hpe-label { color: var(--text-muted); font-size: 13px; }
.hpe-pills { display: flex; flex-wrap: wrap; gap: 6px; }
.hpe-pill {
  background: color-mix(in srgb, var(--text-on-accent) 5%, transparent);
  border: 1px solid var(--border-strong);
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
.hpe-pill:hover { background: color-mix(in srgb, var(--text-on-accent) 9%, transparent); color: var(--text-2); }
.hpe-pill:hover .hpe-pill-img { opacity: 0.8; }
.hpe-pill.active { background: color-mix(in srgb, var(--accent) 25%, transparent); border-color: var(--accent); color: var(--accent-soft); }
.hpe-pill.active .hpe-pill-img { opacity: 1; }
</style>
