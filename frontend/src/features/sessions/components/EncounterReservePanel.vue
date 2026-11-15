<template>
  <section v-show="ui.selected" class="enc-reserve-panel" aria-label="Запас существ" :data-reserve-id="enc.activeReserveId">
    <div class="enc-reserve-actions">
      <ActionButton variant="quiet" icon-only :disabled="!items.length" :aria-label="allSelected ? 'Снять выбор с запаса' : 'Выбрать весь запас'" @click="enc.selectAllInGroup('reserve-npc')"><template #icon><ListChecks :size="20" /></template></ActionButton>
      <ActionButton variant="quiet" icon-only :disabled="!enc.canManageReserves" aria-label="Добавить из бестиария" title="Добавить из бестиария" @click="enc.showNpcPicker = true"><template #icon><BookOpen :size="20" /></template></ActionButton>
      <ActionButton variant="dashed" icon-only :disabled="!enc.canManageReserves" aria-label="Создать упрощённое существо" title="Создать упрощённое существо" @click="enc.showSimpleForm = true"><template #icon><Plus :size="20" /></template></ActionButton>
    </div>
    <p v-if="enc.loadError || enc.saveError" role="alert">{{ enc.loadError || enc.saveError }} <ActionButton v-if="enc.loadError" variant="quiet" @click="enc.load">Повторить</ActionButton></p>
    <div class="enc-reserve-roster" data-sortable-container="reserve-npc">
      <template v-if="!enc.canManageReserves && !enc.loadError"><SkeletonBlock v-for="index in 3" :key="index" width="100%" height="72px" aria-label="Загружаем существ" /></template>
      <p v-else-if="enc.npcReserveCollapsed" class="enc-reserve-hint">Запас недоступен для игроков</p>
      <template v-else>
        <EncounterRow v-for="(combatant,index) in items" :key="combatant.uid" :combatant="combatant" section="reserve-npc" :idx="index" />
        <p v-if="!items.length" class="enc-reserve-hint">Запас пуст</p>
      </template>
    </div>
  </section>
  <ConfirmDialog v-if="ui.pendingDelete" title="Удалить вкладку запаса?" :message="`Вкладка «${ui.pendingDelete.name}» будет удалена. Все существа сохранятся, их запасом станет «Запас».`"
    confirm-label="Удалить вкладку" @confirm="ui.confirmDelete" @cancel="ui.pendingDelete = null" />
</template>
<script setup>
import { computed, provide } from 'vue'
import { ActionButton, ConfirmDialog, SkeletonBlock } from '@sylvieshare/share-ui'
import { BookOpen, ListChecks, Plus } from '@lucide/vue'
import EncounterRow from './EncounterRow.vue'
const props=defineProps({encounter:{type:Object,required:true},ui:{type:Object,required:true}})
const enc=props.encounter
provide('encounter',enc)
const items=computed(()=>enc.sortable.displayItems('reserve-npc'))
const allSelected=computed(()=>items.value.length>0&&items.value.every(row=>enc.isSelected(row)))
</script>
<style scoped>
.enc-reserve-panel {display:flex;flex-direction:column;flex:1;min-height:0;min-width:0;padding:var(--spacing-small) var(--spacing-medium) var(--spacing-large);gap:var(--spacing-small)}
.enc-reserve-actions {display:flex;align-items:center;gap:var(--spacing-xs);flex:none}
.enc-reserve-roster {display:flex;flex-direction:column;flex:1;min-height:0;overflow:auto;gap:var(--spacing-small);padding-inline-end:var(--spacing-xs);scrollbar-gutter:stable}
.enc-reserve-hint {margin:0;padding:var(--spacing-large) var(--spacing-small);color:var(--text-muted);font-size:var(--type-context-size)}
</style>
