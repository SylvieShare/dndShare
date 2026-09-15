<template>
  <aside class="session-tools-rail" aria-label="Инструменты сессии" data-tutorial="session-tools">
    <SessionPresentationControl v-if="presentation" :session-uuid="sessionUuid" :is-dm="true" :presentation="presentation" />
    <SessionTimerControl v-if="timers" :timers="timers" />
    <SessionDiceControl ref="dice" :show-shortcut-hints="showShortcutHints" />
    <SessionTreasureControl />
    <SessionInventoryControl :session-uuid="sessionUuid" />
  </aside>
</template>
<script setup>
import { ref } from 'vue'
import SessionPresentationControl from './SessionPresentationControl.vue'
import SessionTimerControl from './SessionTimerControl.vue'
import SessionDiceControl from './SessionDiceControl.vue'
import SessionTreasureControl from './SessionTreasureControl.vue'
import SessionInventoryControl from './SessionInventoryControl.vue'
defineProps({ sessionUuid: { type: String, required: true }, presentation: Object, timers: Object, showShortcutHints: Boolean })
const dice = ref(null)
defineExpose({ toggleDice: () => dice.value?.toggle(), rollDie: sides => dice.value?.rollDie(sides) })
</script>
<style scoped>
.session-tools-rail { position: absolute; z-index: 16; top: 14px; right: 10px; display: flex; flex-direction: column; align-items: center; gap: 12px; width: 66px; max-height: calc(100% - 28px); overflow-y: auto; scrollbar-width: thin; }
</style>
