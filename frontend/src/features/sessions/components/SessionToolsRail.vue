<template>
  <WorkspaceToolsRail
    class="session-tools-rail"
    aria-label="Инструменты сессии"
    data-tutorial="session-tools"
  >
    <SessionPresentationControl
      v-if="presentation"
      :session-uuid="sessionUuid"
      :is-dm="true"
      :presentation="presentation"
    />
    <SessionTimerControl v-if="timers" :timers="timers" />
    <SessionDiceControl ref="dice" :show-shortcut-hints="showShortcutHints" />
    <SessionTreasureControl />
    <SessionInventoryControl :session-uuid="sessionUuid" />
  </WorkspaceToolsRail>
</template>
<script setup>
import { ref } from "vue";
import WorkspaceToolsRail from "@/shared/ui/WorkspaceToolsRail.vue";
import SessionPresentationControl from "./SessionPresentationControl.vue";
import SessionTimerControl from "./SessionTimerControl.vue";
import SessionDiceControl from "./SessionDiceControl.vue";
import SessionTreasureControl from "./SessionTreasureControl.vue";
import SessionInventoryControl from "./SessionInventoryControl.vue";
defineProps({
  sessionUuid: { type: String, required: true },
  presentation: Object,
  timers: Object,
  showShortcutHints: Boolean,
});
const dice = ref(null);
defineExpose({
  toggleDice: () => dice.value?.toggle(),
  rollDie: (sides) => dice.value?.rollDie(sides),
});
</script>
