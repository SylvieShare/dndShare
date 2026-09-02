<template>
  <div class="session-dice-control">
    <button
      ref="trigger"
      type="button"
      class="session-dice-trigger"
      :class="{ 'session-dice-trigger--active': open }"
      title="Кубики"
      aria-label="Кубики"
      aria-keyshortcuts="Shift+D"
      :aria-expanded="open"
      @click="toggle"
    >
      <Dices :size="17" />
      <kbd v-if="showShortcutHints" class="session-dice-hint" aria-hidden="true">{{ shortcutLabels.panel }}+D</kbd>
      <kbd v-if="showShortcutHints && !open" class="session-dice-hint session-dice-hint--rolls" aria-hidden="true">{{ shortcutLabels.dice }}+1…7 · d4…d100</kbd>
    </button>

    <BasePopover v-model:open="open" :anchor="trigger" :min-width="328" placement="bottom-end" transition-preset="action-menu">
      <DicePanel ref="dicePanel" :show-shortcut-hints="showShortcutHints" />
    </BasePopover>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Dices } from '@lucide/vue'
import { BasePopover } from '@sylvieshare/share-ui'
import DicePanel from '@/features/sessions/components/DicePanel.vue'
import { sessionShortcutLabels } from '@/features/sessions/lib/sessionShortcuts'

defineProps({ showShortcutHints: { type: Boolean, default: false } })

const trigger = ref(null)
const dicePanel = ref(null)
const open = ref(false)
const shortcutLabels = sessionShortcutLabels()

function toggle() { open.value = !open.value }
function rollDie(sides) { dicePanel.value?.rollDie(sides) }

defineExpose({ toggle, rollDie })
</script>

<style scoped>
.session-dice-control { display: contents; }
.session-dice-trigger {
  position: relative;
  width: 34px;
  height: 34px;
  display: inline-grid;
  place-items: center;
  padding: 0;
  border: 1px solid var(--border-strong);
  border-radius: 7px;
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  color: var(--text-2);
  cursor: pointer;
  transition: border-color .15s, background .15s, color .15s;
}
.session-dice-trigger:hover,
.session-dice-trigger--active { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); background: color-mix(in srgb, var(--accent) 13%, transparent); color: var(--text-1); }
.session-dice-hint {
  position: absolute;
  z-index: 24;
  top: calc(100% + 5px);
  left: 50%;
  padding: 2px 5px;
  border: 1px solid color-mix(in srgb, var(--accent) 32%, var(--border));
  border-radius: 5px;
  background: color-mix(in srgb, var(--popover-bg) 94%, transparent);
  color: var(--text-1);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--scrim) 46%, transparent);
  font: 750 9px/1.25 var(--font-ui);
  white-space: nowrap;
  pointer-events: none;
  transform: translateX(-50%);
}
.session-dice-hint--rolls { top: calc(100% + 27px); }
@media (prefers-reduced-motion: reduce) { .session-dice-trigger { transition: none; } }
</style>
