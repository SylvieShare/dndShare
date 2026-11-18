<template>
  <RowActionSubmenu label="Испытание" :min-width="274">
    <template #trigger="{ open }">
      <RowActionItem :icon="Target" submenu :submenu-open="open" aria-label="Провести испытание" :aria-description="`Целей: ${targets.length}`">
        Испытание<template #suffix><SessionActionTargets :items="targets" :encounter="enc" /></template>
      </RowActionItem>
    </template>
    <template #default="{ close }">
      <form class="ecm-panel" @submit.prevent="rollForEveryone(close)">
        <div class="ecm-heading">
          <strong>Испытание выбранным</strong>
          <span>{{ enc.selectedChallengeCount }} {{ participantWord }}</span>
        </div>

        <FormField label="Характеристика" vertical>
          <FormSelect v-model:value="draft.ability">
            <option v-for="ability in enc.challengeAbilities" :key="ability.value" :value="ability.value">
              {{ ability.label }} ({{ ability.short }})
            </option>
          </FormSelect>
        </FormField>

        <ToggleSwitch v-if="enc.challengeSupportsSaves !== false" v-model="draft.savingThrow" label="Спасбросок" />

        <button class="ecm-roll" type="submit" :disabled="enc.challengeBusy">
          <Dices :size="17" />
          Бросить выбранным
        </button>
      </form>
    </template>
  </RowActionSubmenu>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { Dices, Target } from '@lucide/vue'
import { FormField, FormSelect, RowActionSubmenu, ToggleSwitch } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import SessionActionTargets from './SessionActionTargets.vue'

const props = defineProps({
  encounter: { type: Object, required: true },
  targets: { type: Array, required: true },
})
const emit = defineEmits(['done'])
const enc = props.encounter
const draft = reactive({ ability: 'DEX', savingThrow: false })

const participantWord = computed(() => {
  const count = enc.selectedChallengeCount
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'участник'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'участника'
  return 'участников'
})

function rollForEveryone(close) {
  enc.runChallenge({ ...draft })
  close()
  emit('done')
}
</script>

<style scoped>
.ecm-panel {
  display: flex;
  min-width: 0;
  box-sizing: border-box;
  flex-direction: column;
  gap: 13px;
}

.ecm-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-xs) var(--spacing-small);
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
