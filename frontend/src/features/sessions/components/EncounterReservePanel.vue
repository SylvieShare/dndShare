<template>
  <section v-show="ui.selected" class="enc-reserve-panel" aria-label="Запас существ" :data-reserve-id="enc.activeReserveId">
    <p v-if="enc.loadError || enc.saveError" role="alert">{{ enc.loadError || enc.saveError }} <ActionButton v-if="enc.loadError" variant="quiet" @click="enc.load">Повторить</ActionButton></p>
    <SessionRosterList class="enc-reserve-roster" data-sortable-container="reserve-npc">
      <template v-if="!enc.canManageReserves && !enc.loadError"><SkeletonBlock v-for="index in 3" :key="index" width="100%" height="72px" aria-label="Загружаем существ" /></template>
      <p v-else-if="enc.npcReserveCollapsed" class="enc-reserve-hint">Запас недоступен для игроков</p>
      <template v-else>
        <EncounterRow v-for="(combatant,index) in items" :key="combatant.uid" :combatant="combatant" section="reserve-npc" :idx="index" :divided="index > 0" :selection-mode="selection.selecting" />
        <p v-if="!items.length" class="enc-reserve-hint">Запас пуст</p>
      </template>
    </SessionRosterList>
  </section>
  <ConfirmDialog v-if="ui.pendingDelete" title="Удалить вкладку запаса?" :message="`Вкладка «${ui.pendingDelete.name}» будет удалена. Все существа сохранятся, их запасом станет «Запас».`"
    confirm-label="Удалить вкладку" @confirm="ui.confirmDelete" @cancel="ui.pendingDelete = null" />
</template>
<script setup>
import { computed, provide } from 'vue'
import { ActionButton, ConfirmDialog, SkeletonBlock } from '@sylvieshare/share-ui'
import EncounterRow from './EncounterRow.vue'
import SessionRosterList from './SessionRosterList.vue'
const props=defineProps({encounter:{type:Object,required:true},ui:{type:Object,required:true},selection:{type:Object,required:true}})
const enc=props.encounter
provide('encounter',enc)
const items=computed(()=>enc.sortable.displayItems('reserve-npc'))
</script>
<style scoped>
.enc-reserve-panel {display:flex;flex-direction:column;flex:1;min-height:0;min-width:0}
.enc-reserve-hint {margin:0;padding:var(--spacing-large) var(--spacing-small);color:var(--text-muted);font-size:var(--type-context-size)}
</style>
