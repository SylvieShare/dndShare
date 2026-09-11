<template>
  <EditorPanel compact>
    <!-- Heal / damage / temp -->
    <CalcPad v-model="calcAmount" />
    <div class="hpe-actions">
      <button class="hpe-btn hpe-dmg" type="button" @click="applyCalc('damage')">Урон</button>
      <button class="hpe-btn hpe-heal" type="button" @click="applyCalc('heal')">Лечение</button>
      <button class="hpe-btn hpe-temp" type="button" @click="applyCalc('temp')">Временные</button>
    </div>

    <BaseTile class="hpe-section hpe-maximum" color="var(--success)" tint>
      <DndHpHistory :hp="hp" />
      <div class="hpe-equation">
        <span>База <b>{{ maximum.base }}</b></span>
        <span aria-hidden="true">+</span>
        <span>Бонусы <b>{{ bonusTotal }}</b></span>
      </div>
    </BaseTile>

    <section v-if="sourceBonuses.length" class="hpe-field" aria-label="Бонусы от способностей">
      <h3 class="hpe-label">От способностей</h3>
      <div v-for="(bonus, index) in sourceBonuses" :key="bonus.key || index" class="hpe-source">
        <div class="hpe-source-name">
          <span>{{ bonus.name || bonus.title || 'Бонус' }}</span>
          <small v-if="bonus.source_label">{{ bonus.source_label }}</small>
        </div>
        <strong>{{ Number(bonus.value) >= 0 ? '+' : '' }}{{ bonus.value }}</strong>
      </div>
    </section>

    <BaseTile v-if="hitDice.length" class="hpe-section">
      <div class="hpe-section-heading">
        <h3 class="hpe-label">Кости хитов</h3>
        <span class="hpe-hint">Доступно</span>
      </div>
      <div v-for="pool in hitDice" :key="pool.die" class="hpe-dice-row">
        <div class="hpe-die-type"><SystemDie :sides="pool.die" :size="30" /><span>{{ pool.die }}</span></div>
        <div class="hpe-dice-controls">
          <button class="hpe-dice-btn" type="button" :aria-label="`Потратить кость ${pool.die}`" :disabled="pool.used >= pool.total" @click="adjustDice(pool, 1)">−</button>
          <div class="hpe-dice-val"><strong>{{ pool.total - pool.used }}</strong><span>/ {{ pool.total }}</span></div>
          <button class="hpe-dice-btn" type="button" :aria-label="`Вернуть кость ${pool.die}`" :disabled="pool.used <= 0" @click="adjustDice(pool, -1)">+</button>
        </div>
      </div>
    </BaseTile>

    <details class="hpe-settings">
      <summary><span>Настройка хитов</span><span v-if="manualBonuses.length" class="hpe-hint">Бонусов: {{ manualBonuses.length }}</span></summary>
      <div class="hpe-settings-body">
        <FormField label="База хитов">
          <FormNumberInput :value="maximum.base" :min="0" :max="999" @change="setMaximumBase" />
        </FormField>
        <div class="hpe-field">
          <h3 class="hpe-label">Ручные бонусы</h3>
          <BonusList :bonuses="manualBonuses" @update:bonuses="setManualBonuses" />
        </div>
      </div>
    </details>
  </EditorPanel>
</template>

<script setup>
import { computed, ref } from 'vue'
import CalcPad from '@/features/character-editor/components/CalcPad'
import { BaseTile, EditorPanel } from '@sylvieshare/share-ui'
import { FormField } from '@sylvieshare/share-ui'
import { FormNumberInput } from '@sylvieshare/share-ui'
import BonusList from '@/shared/ui/BonusList.vue'
import SystemDie from '@/shared/ui/SystemDie.vue'
import DndHpHistory from './DndHpHistory.vue'
import {
  normalizeHitDice,
  setHitDieUsed,
} from '@/features/character-editor/blocks/dnd/lib/hitDice'
import { hpMaximum, normalizeHpMaximum, withHpBase, withHpBonuses } from '@/features/character-editor/blocks/dnd/lib/hp'

const props = defineProps({
  hp: { type: Object, required: true },
})
const emit = defineEmits(['change'])
const calcAmount = ref('')

const hitDice = computed(() => normalizeHitDice(props.hp))
const maximum = computed(() => normalizeHpMaximum(props.hp.max))
const bonusTotal = computed(() => maximum.value.bonuses.reduce((sum, row) => sum + Math.trunc(Number(row.value) || 0), 0))
const sourceBonuses = computed(() => maximum.value.bonuses.filter((row) => row?.source?.sourceId))
const manualBonuses = computed(() => maximum.value.bonuses.filter((row) => !row?.source?.sourceId))

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
    hp.current = Math.min(hpMaximum(hp), (parseInt(hp.current) || 0) + amount)
  } else if (type === 'temp') {
    hp.temp = (parseInt(hp.temp) || 0) + amount
  }
  emit('change', hp)
  calcAmount.value = ''
}

function adjustDice(pool, delta) {
  emit('change', setHitDieUsed(props.hp, pool.die, pool.used + delta))
}
function setMaximumBase(value) { emit('change', withHpBase(props.hp, value)) }
function setManualBonuses(value) {
  emit('change', withHpBonuses(props.hp, [...sourceBonuses.value, ...value]))
}
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

.hpe-section { display: flex; flex-direction: column; gap: 12px; padding: 14px; }
.hpe-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.hpe-label { margin: 0; color: var(--text-2); font-size: 12px; font-weight: 600; }
.hpe-hint { color: var(--text-muted); font-size: 11px; font-weight: 400; }
.hpe-equation { display: flex; align-items: center; gap: 10px; color: var(--text-muted); font-size: 12px; }
.hpe-equation b { margin-left: 4px; color: var(--text-2); font-variant-numeric: tabular-nums; }
.hpe-dice-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.hpe-die-type { display: flex; align-items: center; gap: 8px; color: var(--text-2); font-size: 13px; }
.hpe-dice-controls { display: flex; align-items: center; gap: 8px; }
.hpe-dice-val { display: flex; align-items: baseline; justify-content: center; gap: 4px; min-width: 54px; font-variant-numeric: tabular-nums; }
.hpe-dice-val strong { color: var(--text-1); font-size: 20px; }
.hpe-dice-val span { color: var(--text-muted); font-size: 12px; }
.hpe-dice-btn {
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: var(--r-sm);
  background: var(--surface-raised); border: 1px solid var(--border-strong);
  color: var(--text-2); font: 600 18px var(--font-ui); cursor: pointer; touch-action: manipulation;
}
.hpe-dice-btn:hover:not(:disabled) { background: var(--surface-active); color: var(--text-1); }
.hpe-dice-btn:disabled { opacity: 0.3; cursor: default; }
.hpe-btn:focus-visible, .hpe-dice-btn:focus-visible, .hpe-settings summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.hpe-field { display: flex; flex-direction: column; gap: 10px; }
.hpe-source { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13px; }
.hpe-source-name { display: flex; flex-direction: column; gap: 3px; min-width: 0; color: var(--text-2); overflow-wrap: anywhere; }
.hpe-source-name small { color: var(--text-muted); font-size: 11px; }
.hpe-source strong { color: var(--success); font-variant-numeric: tabular-nums; }
.hpe-settings { border-top: 1px solid var(--border); }
.hpe-settings summary { padding: 14px 0 2px; color: var(--text-muted); font-size: 12px; cursor: pointer; }
.hpe-settings summary > span + span { margin-left: 8px; }
.hpe-settings summary:hover, .hpe-settings[open] summary { color: var(--text-2); }
.hpe-settings-body { display: flex; flex-direction: column; gap: 16px; padding-top: 16px; }
</style>
