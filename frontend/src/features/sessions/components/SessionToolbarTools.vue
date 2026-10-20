<template>
  <div class="session-toolbar-tools" data-tutorial="session-tools" @pointerenter="show" @pointerleave="scheduleClose">
    <ActionButton ref="button" variant="quiet" aria-label="Инструменты" aria-haspopup="menu" :aria-expanded="open" @click="toggle" @keydown.down.prevent="focusMenu" @keydown.esc.stop="open = false"><template #icon><Wrench :size="20" /></template><span class="session-toolbar-tools-label">Инструменты</span><ChevronDown :size="13" :class="{ expanded: open }" /></ActionButton>
    <BasePopover v-model:open="open" :anchor="anchor" placement="bottom-end" :offset="4" :min-width="205" role="menu" aria-label="Инструменты сессии" transition-preset="action-menu">
      <div ref="menu" class="session-toolbar-tools-list" @pointerenter="keep" @pointerleave="scheduleClose" @focusout="leaveFocus" @keydown="menuKey">
        <ActionMenuItem v-if="presentation" :icon="MonitorUp" @click="launch(screen)">Экран</ActionMenuItem>
        <ActionMenuItem v-if="timers" :icon="Timer" @click="launch(timer)">Таймеры</ActionMenuItem>
        <ActionMenuItem :icon="Dices" @click="toggleDice">Кубики</ActionMenuItem>
        <ActionMenuItem :icon="Backpack" @click="launch(inventory)">Инвентарь</ActionMenuItem>
      </div>
    </BasePopover>
    <SessionPresentationControl v-if="presentation" ref="screen" :session-uuid="sessionUuid" :is-dm="true" :presentation="presentation" :show-trigger="false" :anchor="anchor" />
    <SessionTimerControl v-if="timers" ref="timer" :timers="timers" :show-trigger="false" :anchor="anchor" />
    <SessionDiceControl ref="dice" :show-shortcut-hints="showShortcutHints" :show-trigger="false" :anchor="anchor" />
    <SessionInventoryControl ref="inventory" :session-uuid="sessionUuid" :show-trigger="false" :anchor="anchor" />
  </div>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { ActionButton, ActionMenuItem, BasePopover } from '@sylvieshare/share-ui'
import { Backpack, ChevronDown, Dices, MonitorUp, Timer, Wrench } from '@lucide/vue'
import SessionPresentationControl from './SessionPresentationControl.vue'
import SessionTimerControl from './SessionTimerControl.vue'
import SessionDiceControl from './SessionDiceControl.vue'
import SessionInventoryControl from './SessionInventoryControl.vue'
defineProps({ sessionUuid: { type: String, required: true }, presentation: Object, timers: Object, showShortcutHints: Boolean })
const button = ref(null), menu = ref(null), open = ref(false)
const screen = ref(null), timer = ref(null), dice = ref(null), inventory = ref(null)
const anchor = computed(() => button.value?.$el)
let closeTimer
function keep() { clearTimeout(closeTimer) }
function show(event) { if (event.pointerType !== 'touch') { keep(); open.value = true } }
function toggle() { keep(); open.value = !open.value }
function scheduleClose() { keep(); closeTimer = setTimeout(() => { if (!menu.value?.contains(document.activeElement)) open.value = false }, 200) }
function leaveFocus(event) { if (!menu.value?.contains(event.relatedTarget) && event.relatedTarget !== anchor.value) scheduleClose() }
async function launch(control) { keep(); open.value = false; await nextTick(); control?.toggle() }
function toggleDice() { return launch(dice.value) }
async function focusMenu() { keep(); open.value = true; await nextTick(); menu.value?.querySelector('button')?.focus() }
function menuKey(event) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const items = [...menu.value.querySelectorAll('button')], index = items.indexOf(document.activeElement)
  const target = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
  items[target]?.focus()
}
onBeforeUnmount(keep)
defineExpose({ toggleDice, rollDie: sides => dice.value?.rollDie(sides) })
</script>
<style scoped>
.session-toolbar-tools { display: flex; align-items: center; }
.session-toolbar-tools :deep(.share-action-button > span) { display: flex; align-items: center; gap: 6px; }
.session-toolbar-tools-list { display: grid; gap: 3px; }
.session-toolbar-tools svg { transition: transform .16s ease; }
.session-toolbar-tools svg.expanded { transform: rotate(180deg); }
@media (max-width: 620px) { .session-toolbar-tools-label { display: none; } }
@media (prefers-reduced-motion: reduce) { .session-toolbar-tools svg { transition: none; } }
</style>
