<template>
  <SessionCombatantTile
    class="map-creature-tile"
    :class="{ 'map-creature-tile--selected': selected }"
    :combatant="combatant"
    :section="combatant.position === 'reserve' ? 'reserve-npc' : combatant.position || 'combat'"
    :placed="placed"
    :editable="!!enc?.canEditPlayerHp()"
    role="button"
    tabindex="0"
    aria-haspopup="menu"
    :aria-label="`${entry.markerLetter ? entry.markerLetter + ' · ' : ''}${entry.name}`"
    @pointerdown="drag"
    @pointermove="move"
    @pointercancel="origin = null"
    @dragstart.prevent
    @click="openMenu"
    @contextmenu.prevent="openMenu"
    @keydown.enter.self.prevent="openMenu"
    @keydown.space.self.prevent="openMenu"
  />
  <RowActionMenu ref="menu" :anchor="anchor" :title="entry.name" :trigger-attrs="{ style: { display: 'none' } }">
    <template #default="{ close }">
      <RowActionItem :icon="Focus" @click="$emit('focus'); close()">Выбрать на карте</RowActionItem>
      <RowActionItem v-if="entry.kind === 'creature' && entry.itemId" action="view" @click="enc.openNpcDetail(combatant); close()">Открыть карточку</RowActionItem>
      <EncounterSideMenu v-if="entry.kind === 'creature' && enc.canEditPlayerHp()" :combatant="combatant" />
      <RowActionItem v-if="combatant.position === 'dead' && enc.canEditPlayerHp()" action="revive" @click="enc.requestRevive(combatant); close()">Воскресить</RowActionItem>
    </template>
  </RowActionMenu>
</template>
<script setup>
import { computed, inject, nextTick, ref, shallowRef } from 'vue'
import { Focus } from '@lucide/vue'
import { RowActionMenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import SessionCombatantTile from '@/features/sessions/components/SessionCombatantTile.vue'
import EncounterSideMenu from '@/features/sessions/components/EncounterSideMenu.vue'
const props = defineProps({ entry: { type: Object, required: true }, placed: Boolean, selected: Boolean })
const combatant = computed(() => props.entry.combatant || { type: 'player', charId: props.entry.participant.charId, position: 'reserve' })
const emit = defineEmits(['drag', 'focus'])
const enc = inject('encounter', null) || inject('applicationEncounter', null)
const menu = ref(null), anchor = shallowRef(null)
const INTERACTIVE = 'button, input, a, .p-statuses-area, .enc-hp-area'
let origin = null, moved = false
function drag(event) {
  if (event.button !== 0 || event.target.closest(INTERACTIVE)) return
  origin = { x: event.clientX, y: event.clientY }
  moved = false
  emit('drag', event)
}
function move(event) {
  if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) >= 5) { moved = true; menu.value?.close() }
}
async function openMenu(event) {
  if (event.target.closest(INTERACTIVE) || (event.type === 'click' && moved)) return
  anchor.value = event.currentTarget
  origin = null
  await nextTick()
  menu.value?.toggle()
}
</script>
<style scoped>
.map-creature-tile { cursor: grab; touch-action: none; }
.map-creature-tile:active { cursor: grabbing; }
.map-creature-tile:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.map-creature-tile--selected { background: color-mix(in srgb, var(--accent) 11%, var(--surface)); }
</style>
