<template>
  <EditorPanel>
    <CalcPad v-model="calcAmount" />
    <div class="lved-actions">
      <button class="lved-add lved-add-sub" type="button" :disabled="evalAmount <= 0" @click="applyXp(-1)">−</button>
      <button class="lved-add lved-add-main" type="button" :disabled="evalAmount <= 0" @click="applyXp(1)">+ {{ evalAmount > 0 ? evalAmount : '' }} опыт</button>
    </div>

    <button v-if="canLevelUp" class="lved-levelup" type="button" @click="levelUp">↑ Level Up! → {{ level + 1 }} уровень</button>

    <FormField label="Уровень">
      <FormNumberInput :value="level" :min="1" :max="20" @change="set('level', $event)" />
    </FormField>
    <FormField label="Опыт">
      <FormNumberInput :value="data.exp || 0" :min="0" :max="355000" @change="set('exp', $event)" />
    </FormField>
  </EditorPanel>
</template>

<script setup>
import { computed, ref } from 'vue'
import CalcPad from '@/features/character-editor/components/CalcPad'
import EditorPanel from '@/features/character-editor/components/EditorPanel'
import FormField from '@/shared/ui/form/FormField'
import FormNumberInput from '@/shared/ui/form/FormNumberInput'

const EXPERIENCE = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000,
  48000, 64000, 85000, 100000, 120000, 140000, 165000,
  195000, 225000, 265000, 305000, 355000,
]

const props = defineProps({ data: { type: Object, required: true } })
const emit = defineEmits(['change'])
const calcAmount = ref('')

const level = computed(() => Math.max(1, Math.min(20, parseInt(props.data.level) || 1)))
const nextLevelExp = computed(() => (level.value < 20 ? EXPERIENCE[level.value] : null))
const evalAmount = computed(() => {
  const clean = String(calcAmount.value).replace(/−/g, '-').replace(/[^0-9+\-*/\s.]/g, '')
  if (!clean.trim()) return 0
  try {
    // eslint-disable-next-line no-new-func
    return Math.abs(Math.round(new Function('return (' + clean + ')')())) || 0
  } catch { return 0 }
})
const canLevelUp = computed(() => {
  if (level.value >= 20 || nextLevelExp.value === null) return false
  return (parseInt(props.data.exp) || 0) >= nextLevelExp.value
})

function applyXp(sign) {
  if (evalAmount.value <= 0) return
  const newExp = Math.max(0, (parseInt(props.data.exp) || 0) + sign * evalAmount.value)
  emit('change', { ...props.data, exp: newExp })
  calcAmount.value = ''
}
function levelUp() { emit('change', { ...props.data, level: Math.min(20, level.value + 1) }) }
function set(field, value) { emit('change', { ...props.data, [field]: value }) }
</script>

<style scoped>
.lved-actions { display: flex; gap: 6px; }
.lved-add { background: color-mix(in srgb, var(--accent) 20%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); border-radius: 8px; color: var(--color-attack); font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer; transition: background 0.12s, opacity 0.12s; touch-action: manipulation; }
.lved-add-main { flex: 1; padding: 18px 12px; }
.lved-add-sub { padding: 10px 16px; font-size: 18px; }
.lved-add:hover:not(:disabled) { background: color-mix(in srgb, var(--accent) 32%, transparent); }
.lved-add:disabled { opacity: 0.3; cursor: not-allowed; }

.lved-levelup { width: 100%; background: color-mix(in srgb, var(--accent) 18%, transparent); border: 1px solid var(--accent); border-radius: 10px; color: var(--color-attack); font-size: 14px; font-weight: 800; font-family: inherit; padding: 10px 16px; cursor: pointer; transition: background 0.15s; }
.lved-levelup:hover { background: color-mix(in srgb, var(--accent) 32%, transparent); }
</style>
