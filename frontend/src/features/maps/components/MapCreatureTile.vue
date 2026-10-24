<template>
  <SessionCombatantTile class="map-creature-tile" :class="{ 'map-creature-tile--selected': selected }"
    :combatant="combatant" :section="combatant.position === 'reserve' ? 'reserve-npc' : combatant.position || 'combat'"
    :placed="placed" :editable="!!enc?.canEditPlayerHp()" role="button" tabindex="0" :aria-label="`${entry.markerLetter ? entry.markerLetter + ' · ' : ''}${entry.name}`"
    @pointerdown="drag" @dragstart.prevent @keydown.enter.self.prevent="$emit('focus')" @keydown.space.self.prevent="$emit('focus')">
    <template #actions>
      <span @pointerdown.stop @click.stop @keydown.stop>
        <RowActionMenu :title="entry.name">
          <template #trigger><button type="button" class="map-creature-actions" :aria-label="`Действия: ${entry.name}`"><MoreHorizontal :size="16" /></button></template>
          <template #default="{ close }">
            <RowActionItem :icon="Focus" @click="$emit('focus'); close()">Выбрать на карте</RowActionItem>
            <RowActionItem v-if="entry.kind === 'creature' && entry.itemId" action="view" @click="enc.openNpcDetail(entry.combatant); close()">Открыть карточку</RowActionItem>
            <EncounterSideMenu v-if="entry.kind === 'creature' && enc.canEditPlayerHp()" :combatant="combatant" />
            <RowActionItem v-if="combatant.position === 'dead' && enc.canEditPlayerHp()" action="revive" @click="enc.requestRevive(entry.combatant); close()">Воскресить</RowActionItem>
          </template>
        </RowActionMenu>
      </span>
    </template>
  </SessionCombatantTile>
</template>
<script setup>
import { computed, inject } from 'vue'
import { Focus, MoreHorizontal } from '@lucide/vue'
import { RowActionMenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import SessionCombatantTile from '@/features/sessions/components/SessionCombatantTile.vue'
import EncounterSideMenu from '@/features/sessions/components/EncounterSideMenu.vue'
const props = defineProps({ entry: { type: Object, required: true }, placed: Boolean, selected: Boolean })
const combatant = computed(() => props.entry.combatant || { type: 'player', charId: props.entry.participant.charId, position: 'reserve' })
const emit = defineEmits(['drag', 'focus'])
const enc = inject('encounter', null) || inject('applicationEncounter', null)
function drag(event) {
  if (event.target.closest('button, input, a, .p-statuses-area, .enc-hp-area')) return
  emit('drag', event)
}
</script>
<style scoped>
.map-creature-tile { cursor: grab; touch-action: none; }
.map-creature-tile:active { cursor: grabbing; }
.map-creature-tile:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.map-creature-tile--selected { background: color-mix(in srgb, var(--accent) 11%, var(--surface)); }
.map-creature-actions { display: grid; place-items: center; padding: 2px; border: 0; border-radius: var(--r-sm); background: transparent; color: var(--text-muted); cursor: pointer; }
.map-creature-actions:hover { background: var(--surface-raised); color: var(--text-1); }
</style>
