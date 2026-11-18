<template>
  <BaseTile class="enc-toolbar" :outlined="false" :inert="transitioning">
    <div class="enc-toolbar-heading"><h2>{{ enc.encounter.active ? "Бой" : "Подготовка" }}</h2><span class="enc-heading-summary">{{enc.inCombat.length}} на сцене<span class="enc-status" :class="{'enc-status--active':enc.encounter.active}" /></span></div>
    <div class="enc-toolbar-body">
      <div class="enc-toolbar-top">
        <div class="enc-toolbar-flow" aria-label="Управление боем">
          <button
            type="button"
            class="enc-icon-btn enc-icon-btn--primary"
            :class="{ 'enc-icon-btn--end': enc.encounter.active }"
            :disabled="transitioning || (!enc.encounter.active && startSelectionCount === 0)"
            :title="enc.encounter.active ? 'Закончить бой' : `Начать бой (${startSelectionCount})`"
            :aria-label="enc.encounter.active ? 'Закончить бой' : 'Начать бой'"
            aria-keyshortcuts="Shift+Enter"
            @click="$emit('toggle-combat')"
          >
            <Square v-if="enc.encounter.active" :size="22" />
            <Swords v-else :size="23" />
            <span class="enc-primary-label">{{ enc.encounter.active ? 'Закончить бой' : 'Начать бой' }}</span>
            <span v-if="!enc.encounter.active && startSelectionCount" class="enc-icon-count">{{ startSelectionCount }}</span>
            <kbd v-if="showShortcutHints" class="enc-shortcut-hint" aria-hidden="true">{{ shortcutLabels.panel }}+Enter</kbd>
          </button>

          <template v-if="enc.encounter.active">
            <div class="enc-turn-group">
              <div class="enc-round-wrap" title="Текущий раунд">
                <span class="enc-round-label">Раунд</span>
                <span class="enc-round-num">{{ enc.encounter.round }}</span>
              </div>

              <button class="enc-icon-btn" :disabled="enc.inCombat.length === 0" title="Предыдущий ход" aria-label="Предыдущий ход" aria-keyshortcuts="ArrowLeft" @click="enc.prevTurn">
                <ChevronLeft :size="18" />
                <kbd v-if="showShortcutHints" class="enc-shortcut-hint" aria-hidden="true">←</kbd>
              </button>
              <button class="enc-icon-btn enc-icon-btn--next" :disabled="enc.inCombat.length === 0" title="Следующий ход" aria-label="Следующий ход" aria-keyshortcuts="ArrowRight" @click="enc.nextTurn">
                <ChevronRight :size="18" />
                <kbd v-if="showShortcutHints" class="enc-shortcut-hint" aria-hidden="true">→</kbd>
              </button>
            </div>
          </template>
        </div>
      </div>

      <div class="enc-toolbar-actions">
        <div v-if="props.isDm" class="enc-action-group" aria-label="Действия с выбранными участниками">
          <span class="enc-action-group-label">Выбранные</span>
          <SessionSelectionToolbar :encounter="enc" :selection="selection" :actions-visible="false" :visible-items="combatItems" visible-label="Выбрать всех на сцене" label="Выбор на боевой сцене" />
          <div class="enc-action-group-controls">
            <EncounterChallengeMenu label="Испытание" />
            <EncounterBulkDamageMenu label="Урон" />
            <button
              v-if="props.isDm"
              type="button"
              class="enc-icon-btn"
              :disabled="enc.selectedRerollCount === 0"
              title="Перебросить инициативу выбранным"
              aria-label="Перебросить инициативу выбранным"
              aria-keyshortcuts="Shift+R"
              @click="enc.rerollSelectedInitiative"
            >
              <Dices :size="18" /><span class="enc-control-label">Инициатива</span>
              <span v-if="enc.selectedRerollCount" class="enc-icon-count">{{ enc.selectedRerollCount }}</span>
              <kbd v-if="showShortcutHints" class="enc-shortcut-hint" aria-hidden="true">{{ shortcutLabels.panel }}+R</kbd>
            </button>


          </div>
        </div>
        <div v-if="props.isDm" class="enc-action-group" aria-label="Состав сцены">
          <span class="enc-action-group-label">Состав сцены</span>
          <div class="enc-action-group-controls">
            <button type="button" class="enc-icon-btn" :disabled="!combatMoveCount" aria-label="Добавить выбранных на сцену" @click="enc.sendSelectedTo('combat')"><LogIn :size="18" /><span class="enc-control-label">На сцену</span><span v-if="combatMoveCount" class="enc-icon-count">{{combatMoveCount}}</span></button>
            <button
              type="button"
              class="enc-icon-btn enc-icon-btn--danger"
              :disabled="deadMoveCount === 0"
              title="Убить выбранных — переместить на кладбище"
              aria-label="Убить выбранных — переместить на кладбище"
              @click="enc.sendSelectedTo('dead')"
            >
              <Skull :size="18" /><span class="enc-control-label">На кладбище</span>
              <span v-if="deadMoveCount" class="enc-icon-count">{{ deadMoveCount }}</span>
            </button>
            <button
              type="button"
              class="enc-icon-btn enc-icon-btn--danger"
              :disabled="enc.selectedNpcCount === 0"
              title="Удалить выбранных НПС"
              aria-label="Удалить выбранных НПС"
              aria-keyshortcuts="Backspace"
              @click="enc.removeSelectedNpcs"
            >
              <Trash2 :size="18" /><span class="enc-control-label">Удалить</span>
              <span v-if="enc.selectedNpcCount" class="enc-icon-count">{{ enc.selectedNpcCount }}</span>
              <kbd v-if="showShortcutHints" class="enc-shortcut-hint" aria-hidden="true">⌫</kbd>
            </button>
            <EncounterGraveyardMenu label="Кладбище" :is-dm="props.isDm" @view-participant="$emit('view-participant', $event)" />
            <EncounterScenarioCombatMenu
              v-if="props.isDm && scene"
              :session-uuid="sessionUuid"
              :scene="scene"
              @pick="$emit('import-combat-block', $event)"
            />

          </div>
        </div>
      </div>
    </div>
  </BaseTile>
</template>
<script setup>
import { computed } from 'vue'
import { ChevronLeft, ChevronRight, Dices, LogIn, Skull, Square, Swords, Trash2 } from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'
import EncounterBulkDamageMenu from './EncounterBulkDamageMenu.vue'
import EncounterChallengeMenu from './EncounterChallengeMenu.vue'
import EncounterGraveyardMenu from './EncounterGraveyardMenu.vue'
import EncounterScenarioCombatMenu from './EncounterScenarioCombatMenu.vue'
import SessionSelectionToolbar from './SessionSelectionToolbar.vue'
import { sessionShortcutLabels } from '../lib/sessionShortcuts'
const props=defineProps({sessionUuid:String,isDm:Boolean,encounter:{type:Object,required:true},selection:{type:Object,required:true},scene:Object,showShortcutHints:Boolean,transitioning:Boolean})
defineEmits(['toggle-combat','view-participant','import-combat-block'])
const enc=props.encounter
const shortcutLabels=sessionShortcutLabels()
const combatItems=computed(()=>enc.sortable.displayItems('combat'))
const startSelectionCount=computed(()=>enc.inCombat.length)
const combatMoveCount=computed(()=>enc.selectedToMoveTo('combat'))
const deadMoveCount=computed(()=>enc.selectedToMoveTo('dead'))
</script>
<style scoped src="./styles/EncounterToolbar.css"></style>
