<template>
  <button
    ref="anchorEl"
    type="button"
    class="enc-icon-btn"
    :class="{ 'enc-icon-btn--challenge-active': enc.challengeActive }"
    :disabled="!enc.challengeActive && enc.selectedChallengeCount === 0"
    :title="enc.challengeActive ? 'Сбросить результаты испытания' : 'Провести испытание'"
    :aria-label="enc.challengeActive ? 'Сбросить результаты испытания' : 'Провести испытание'"
    :aria-expanded="open"
    @click="onButtonClick"
  >
    <Target :size="18" />
  </button>

  <BasePopover
    v-model:open="open"
    :anchor="anchorEl"
    placement="bottom-end"
    :min-width="274"
  >
    <form class="ecm-panel" @submit.prevent="rollForEveryone">
      <div class="ecm-heading">
        <strong>Испытание выбранным</strong>
        <span>{{ enc.selectedChallengeCount }} {{ participantWord }}</span>
      </div>

      <FormField label="Характеристика" vertical>
        <FormSelect v-model:value="draft.ability">
          <option
            v-for="ability in enc.challengeAbilities"
            :key="ability.value"
            :value="ability.value"
          >{{ ability.label }} ({{ ability.short }})</option>
        </FormSelect>
      </FormField>

      <ToggleSwitch v-model="draft.savingThrow" label="Спасбросок" />

      <button class="ecm-roll" type="submit">
        <Dices :size="17" />
        Бросить выбранным
      </button>
    </form>
  </BasePopover>
</template>

<script setup>
import { computed, inject, reactive, ref } from 'vue'
import { Dices, Target } from '@lucide/vue'
import { BasePopover } from '@sylvieshare/share-ui'
import { FormField } from '@sylvieshare/share-ui'
import { FormSelect } from '@sylvieshare/share-ui'
import { ToggleSwitch } from '@sylvieshare/share-ui'

const enc = inject('encounter')
const anchorEl = ref(null)
const open = ref(false)
const draft = reactive({ ability: 'DEX', savingThrow: false })

const participantWord = computed(() => {
  const count = enc.selectedChallengeCount
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'участник'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'участника'
  return 'участников'
})

function onButtonClick() {
  if (enc.challengeActive) {
    enc.resetChallenge()
    open.value = false
    return
  }
  open.value = !open.value
}

function rollForEveryone() {
  enc.runChallenge({ ...draft })
  open.value = false
}
</script>

<style scoped>
.ecm-panel {
  display: flex;
  width: 274px;
  box-sizing: border-box;
  flex-direction: column;
  gap: 13px;
}

.ecm-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.ecm-heading strong {
  color: var(--text-1);
  font-size: 14px;
}

.ecm-heading span {
  color: var(--text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.ecm-roll {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid color-mix(in srgb, var(--accent) 65%, transparent);
  border-radius: 8px;
  background: var(--accent);
  color: var(--text-on-accent);
  font: inherit;
  font-size: 13px;
  font-weight: 750;
  cursor: pointer;
  transition: background 0.14s, transform 0.1s;
}

.ecm-roll:hover { background: color-mix(in srgb, var(--accent) 84%, var(--text-on-accent)); }
.ecm-roll:active { transform: scale(0.98); }
</style>
