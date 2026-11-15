<template>
  <div class="session-toolbar-tools" role="group" aria-label="Инструменты сессии" data-tutorial="session-tools">
    <ActionButton v-if="presentation" ref="screenButton" :aria-expanded="!!screen?.open" variant="quiet" layout="stacked" :icon-only="compact" aria-label="Экран показа" title="Экран показа" @click="screen?.toggle()">
      <template #icon><MonitorUp :size="24" aria-hidden="true" /></template><span v-if="!compact">Экран</span>
    </ActionButton>
    <ActionButton v-if="timers" ref="timerButton" :aria-expanded="!!timer?.open" variant="quiet" layout="stacked" :icon-only="compact" aria-label="Таймеры" title="Таймеры" @click="timer?.toggle()">
      <template #icon><Timer :size="24" aria-hidden="true" /></template><span v-if="!compact">Таймеры</span>
    </ActionButton>
    <ActionButton ref="diceButton" :aria-expanded="!!dice?.open" variant="quiet" layout="stacked" :icon-only="compact" aria-label="Кубики" title="Кубики" aria-keyshortcuts="Shift+D" @click="toggleDice">
      <template #icon><Dices :size="24" aria-hidden="true" /></template><span v-if="!compact">Кубики</span>
    </ActionButton>
    <ActionButton ref="inventoryButton" :aria-expanded="!!inventory?.open" aria-haspopup="dialog" variant="quiet" layout="stacked" :icon-only="compact" aria-label="Инвентарь" title="Инвентарь" @click="inventory?.toggle()">
      <template #icon><Backpack :size="24" aria-hidden="true" /></template><span v-if="!compact">Инвентарь</span>
    </ActionButton>
    <SessionPresentationControl v-if="presentation" ref="screen" :session-uuid="sessionUuid" :is-dm="true" :presentation="presentation" :show-trigger="false" :anchor="screenButton?.$el" />
    <SessionTimerControl v-if="timers" ref="timer" :timers="timers" :show-trigger="false" :anchor="timerButton?.$el" />
    <SessionDiceControl ref="dice" :show-shortcut-hints="showShortcutHints" :show-trigger="false" :anchor="diceButton?.$el" />
    <SessionInventoryControl ref="inventory" :session-uuid="sessionUuid" :show-trigger="false" :anchor="inventoryButton?.$el" />
  </div>
</template>
<script setup>
import { ref } from 'vue'
import { ActionButton } from '@sylvieshare/share-ui'
import { Backpack, Dices, MonitorUp, Timer } from '@lucide/vue'
import SessionPresentationControl from './SessionPresentationControl.vue'
import SessionTimerControl from './SessionTimerControl.vue'
import SessionDiceControl from './SessionDiceControl.vue'
import SessionInventoryControl from './SessionInventoryControl.vue'
defineProps({ sessionUuid: { type: String, required: true }, presentation: Object, timers: Object, showShortcutHints: Boolean, compact: Boolean })
const screenButton = ref(null), timerButton = ref(null), diceButton = ref(null), inventoryButton = ref(null)
const screen = ref(null), timer = ref(null), dice = ref(null), inventory = ref(null)
function toggleDice() { dice.value?.toggle() }
defineExpose({ toggleDice, rollDie: sides => dice.value?.rollDie(sides) })
</script>
<style scoped>
.session-toolbar-tools { display: flex; align-items: center; gap: var(--spacing-xs); }
</style>
