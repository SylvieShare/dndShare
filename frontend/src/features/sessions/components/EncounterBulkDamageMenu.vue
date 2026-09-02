<template>
  <button
    ref="anchorEl"
    type="button"
    class="enc-icon-btn enc-icon-btn--damage"
    :disabled="enc.selectedDamageCount === 0"
    title="Нанести урон выбранным"
    aria-label="Нанести урон выбранным"
    :aria-expanded="open"
    @click="open = !open"
  >
    <HeartCrack :size="18" />
    <span v-if="enc.selectedDamageCount" class="enc-icon-count">{{ enc.selectedDamageCount }}</span>
  </button>

  <BasePopover v-model:open="open" :anchor="anchorEl" placement="bottom-end" :min-width="260">
    <form class="bulk-damage" @submit.prevent="applyDamage">
      <div class="bulk-damage-heading">
        <strong>Урон выбранным</strong>
        <span>{{ enc.selectedDamageCount }} целей</span>
      </div>
      <FormField label="Количество урона" vertical>
        <FormNumberInput :value="amount" :min="1" :max="9999" autofocus @change="amount = $event" />
      </FormField>
      <p v-if="error" class="bulk-damage-error" role="alert">{{ error }}</p>
      <button class="bulk-damage-submit" type="submit" :disabled="pending || amount < 1">
        <HeartCrack :size="17" />
        {{ pending ? 'Применяем…' : 'Нанести урон' }}
      </button>
    </form>
  </BasePopover>
</template>

<script setup>
import { inject, ref, watch } from 'vue'
import { HeartCrack } from '@lucide/vue'
import { BasePopover, FormField, FormNumberInput } from '@sylvieshare/share-ui'

const enc = inject('encounter')
const anchorEl = ref(null)
const open = ref(false)
const amount = ref(1)
const pending = ref(false)
const error = ref('')

watch(open, value => {
  if (value) error.value = ''
})

async function applyDamage() {
  const value = Math.max(0, Math.floor(Number(amount.value) || 0))
  if (!value || pending.value) return
  pending.value = true
  error.value = ''
  try {
    await enc.applyDamageToSelected(value)
    open.value = false
    amount.value = 1
  } catch (reason) {
    error.value = reason?.message || 'Не удалось применить урон'
  } finally {
    pending.value = false
  }
}
</script>

<style scoped>
.bulk-damage { display: flex; width: 260px; box-sizing: border-box; flex-direction: column; gap: 13px; }
.bulk-damage-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
.bulk-damage-heading strong { color: var(--text-1); font-size: 14px; }
.bulk-damage-heading span { color: var(--text-muted); font-size: 11px; white-space: nowrap; }
.bulk-damage-error { margin: 0; color: var(--danger); font-size: 11px; }
.bulk-damage-submit {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid color-mix(in srgb, var(--danger) 52%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--danger) 16%, var(--surface-raised));
  color: var(--danger);
  font: inherit;
  font-size: 13px;
  font-weight: 750;
  cursor: pointer;
  transition: background 0.14s, border-color 0.14s, transform 0.1s;
}
.bulk-damage-submit:hover:not(:disabled) { border-color: var(--danger); background: color-mix(in srgb, var(--danger) 24%, var(--surface-raised)); }
.bulk-damage-submit:active:not(:disabled) { transform: scale(0.98); }
.bulk-damage-submit:disabled { cursor: wait; opacity: 0.5; }
</style>
