<template>
  <EditorPanel>
    <CalcPad v-model="calcAmount" />
    <div class="lved-actions">
      <button class="lved-add lved-add-sub" type="button" :disabled="evalAmount <= 0" @click="applyXp(-1)">−</button>
      <button class="lved-add lved-add-main" type="button" :disabled="evalAmount <= 0" @click="applyXp(1)">+ {{ evalAmount > 0 ? evalAmount : '' }} опыт</button>
    </div>

    <button
      class="lved-levelup"
      :class="{ 'lved-levelup-ready': canLevelUp }"
      :disabled="nextLevelExp === null"
      type="button"
      @click="requestLevelUp"
    >{{ nextLevelExp === null ? 'Максимальный уровень' : `↑ Level Up! → ${level + 1}` }}</button>

    <ActionButton variant="secondary" @click="$emit('manual')">Изменить уровни вручную</ActionButton>
    <FormField label="Опыт">
      <FormNumberInput :value="data.exp || 0" :min="0" :max="355000" @change="set('exp', $event)" />
    </FormField>
  </EditorPanel>
  <ConfirmDialog
    v-if="confirmLevelUp"
    :title="`Перейти на ${level + 1}-й уровень?`"
    :message="confirmationMessage"
    confirm-label="Продолжить повышение"
    cancel-label="Отменить"
    variant="warning"
    :z-index="3200"
    @confirm="confirmExperience"
    @cancel="confirmLevelUp = false"
  />
</template>

<script setup>
import { computed, ref } from 'vue'
import CalcPad from '@/features/character-editor/components/CalcPad'
import { ActionButton, ConfirmDialog, EditorPanel } from '@sylvieshare/share-ui'
import { FormField } from '@sylvieshare/share-ui'
import { FormNumberInput } from '@sylvieshare/share-ui'

import { levelExperience } from '../lib/experience'

const props = defineProps({ data: { type: Object, required: true } })
const emit = defineEmits(['change', 'levelup', 'manual'])
const calcAmount = ref('')
const confirmLevelUp = ref(false)

const progress = computed(() => levelExperience(props.data))
const level = computed(() => progress.value.level)
const nextLevelExp = computed(() => progress.value.nextLevelExp)
const canLevelUp = computed(() => progress.value.canLevelUp)
const confirmationMessage = computed(() => `До следующего уровня не хватает ${progress.value.missingExp.toLocaleString('ru-RU')} опыта. `
  + `Добавим недостающее, чтобы общий опыт достиг ${nextLevelExp.value?.toLocaleString('ru-RU')}, и откроем повышение уровня. `
  + 'Вы сможете выбрать новые возможности персонажа. Опыт и новый уровень сохранятся после применения повышения; отмена оставит персонажа без изменений.')
const evalAmount = computed(() => {
  const clean = String(calcAmount.value).replace(/−/g, '-').replace(/[^0-9+\-*/\s.]/g, '')
  if (!clean.trim()) return 0
  try {
    // eslint-disable-next-line no-new-func
    return Math.abs(Math.round(new Function('return (' + clean + ')')())) || 0
  } catch { return 0 }
})

function requestLevelUp() {
  if (nextLevelExp.value === null) return
  if (canLevelUp.value) emit('levelup')
  else confirmLevelUp.value = true
}

function confirmExperience() {
  confirmLevelUp.value = false
  if (nextLevelExp.value !== null) emit('levelup', nextLevelExp.value)
}

function applyXp(sign) {
  if (evalAmount.value <= 0) return
  const newExp = Math.max(0, (parseInt(props.data.exp) || 0) + sign * evalAmount.value)
  emit('change', { ...props.data, exp: newExp })
  calcAmount.value = ''
}
function set(field, value) { emit('change', { ...props.data, [field]: value }) }
</script>

<style scoped>
.lved-actions { display: flex; gap: 6px; }
.lved-add { background: color-mix(in srgb, var(--accent) 20%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); border-radius: 8px; color: var(--accent-soft); font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer; transition: background 0.12s, opacity 0.12s; touch-action: manipulation; }
.lved-add-main { flex: 1; padding: 18px 12px; }
.lved-add-sub { padding: 10px 16px; font-size: 18px; }
.lved-add:hover:not(:disabled) { background: color-mix(in srgb, var(--accent) 32%, transparent); }
.lved-add:disabled { opacity: 0.3; cursor: not-allowed; }

.lved-levelup { width: 100%; background: var(--surface-raised); border: 1px solid var(--border-strong); border-radius: 10px; color: var(--text-muted); font-size: 14px; font-weight: 800; font-family: inherit; padding: 10px 16px; cursor: pointer; transition: background 0.15s; }
.lved-levelup:hover:not(:disabled) { background: color-mix(in srgb, var(--text-muted) 12%, var(--surface-raised)); }
.lved-levelup:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.lved-levelup:disabled { opacity: .55; cursor: default; }
.lved-levelup-ready { background: color-mix(in srgb, var(--accent) 18%, transparent); border-color: var(--accent); color: var(--accent-soft); animation: lved-pulse 2s ease-in-out infinite; }
.lved-levelup-ready:hover:not(:disabled) { background: color-mix(in srgb, var(--accent) 32%, transparent); }
@media (prefers-reduced-motion: reduce) { .lved-levelup-ready { animation: none; } }
@keyframes lved-pulse { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 40%, transparent); } 50% { box-shadow: 0 0 12px 2px color-mix(in srgb, var(--accent) 30%, transparent); } }
</style>
