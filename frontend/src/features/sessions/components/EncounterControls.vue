<template>
  <div class="enc-toolbar" :inert="transitioning">
    <BaseTile class="enc-control-panel" :outlined="false" role="group" aria-label="Управление боем">
      <header class="enc-toolbar-heading">
        <h2>{{ enc.encounter.active ? 'Бой' : 'Подготовка' }}</h2>
        <span class="enc-heading-summary">
          <span class="enc-status" :class="{ 'enc-status--active': enc.encounter.active }" />
          {{ enc.inCombat.length }} на сцене
        </span>
      </header>

      <div v-if="enc.encounter.active" class="enc-turn-group">
        <button type="button" class="enc-icon-btn" :disabled="enc.inCombat.length === 0" aria-label="Предыдущий ход" title="Предыдущий ход" aria-keyshortcuts="ArrowLeft" @click="enc.prevTurn">
          <ChevronLeft :size="18" />
          <kbd v-if="showShortcutHints" class="enc-shortcut-hint" aria-hidden="true">←</kbd>
        </button>
        <div class="enc-round-wrap">
          <span class="enc-round-label">Раунд</span>
          <strong class="enc-round-num">{{ enc.encounter.round }}</strong>
        </div>
        <button type="button" class="enc-icon-btn enc-icon-btn--next" :disabled="enc.inCombat.length === 0" aria-label="Следующий ход" title="Следующий ход" aria-keyshortcuts="ArrowRight" @click="enc.nextTurn">
          <ChevronRight :size="18" />
          <kbd v-if="showShortcutHints" class="enc-shortcut-hint" aria-hidden="true">→</kbd>
        </button>
      </div>

      <button
        type="button"
        class="enc-icon-btn enc-battle-toggle"
        :class="enc.encounter.active ? 'enc-battle-toggle--end' : 'enc-battle-toggle--start'"
        :disabled="transitioning || (!enc.encounter.active && startSelectionCount === 0)"
        :aria-label="enc.encounter.active ? 'Закончить бой' : 'Начать бой'"
        aria-keyshortcuts="Shift+Enter"
        @click="$emit('toggle-combat')"
      >
        <Square v-if="enc.encounter.active" :size="16" />
        <Swords v-else :size="20" />
        <span>{{ enc.encounter.active ? 'Закончить бой' : 'Начать бой' }}</span>
        <kbd v-if="showShortcutHints" class="enc-shortcut-hint" aria-hidden="true">{{ shortcutLabels.panel }}+Enter</kbd>
      </button>
    </BaseTile>

    <BaseTile v-if="isDm" class="enc-control-panel enc-selection-panel" :outlined="false" role="group" aria-label="Действия с выбранными участниками">
      <SessionSelectionToolbar
        :encounter="enc"
        :selection="selection"
        grouped-summary
        :actions-visible="false"
        :visible-items="combatItems"
        visible-label="Выбрать всех на сцене"
        label="Выбор на боевой сцене"
      />
      <div class="enc-action-row">
        <EncounterChallengeMenu label="Испытание" />
        <EncounterBulkDamageMenu label="Урон" />
      </div>
    </BaseTile>

    <BaseTile v-if="isDm" class="enc-control-panel" :outlined="false" role="group" aria-label="Состав сцены">
      <h3 class="enc-action-group-label">Состав сцены</h3>
      <div class="enc-action-row">
        <button type="button" class="enc-icon-btn" :disabled="!combatMoveCount" aria-label="Добавить выбранных на сцену" @click="enc.sendSelectedTo('combat')">
          <LogIn :size="18" />
          <span class="enc-control-label">На сцену</span>
          <span v-if="combatMoveCount" class="enc-icon-count">{{ combatMoveCount }}</span>
        </button>
        <EncounterScenarioCombatMenu v-if="scene" :session-uuid="sessionUuid" :scene="scene" @pick="$emit('import-combat-block', $event)" />
      </div>
      <div class="enc-action-row enc-danger-row" role="group" aria-label="Поражение и удаление">
        <button
          type="button"
          class="enc-icon-btn enc-icon-btn--danger"
          :disabled="deadMoveCount === 0 || enc.impactBusy"
          title="Отметить выбранных погибшими"
          aria-label="Отметить выбранных погибшими"
          @click="enc.sendSelectedTo('dead')"
        >
          <Skull :size="18" />
          <span class="enc-control-label">Отметить погибшими</span>
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
          <Trash2 :size="18" />
          <span class="enc-control-label">Удалить НПС</span>
          <span v-if="enc.selectedNpcCount" class="enc-icon-count">{{ enc.selectedNpcCount }}</span>
          <kbd v-if="showShortcutHints" class="enc-shortcut-hint" aria-hidden="true">⌫</kbd>
        </button>
      </div>
    </BaseTile>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { ChevronLeft, ChevronRight, LogIn, Skull, Square, Swords, Trash2 } from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'
import EncounterBulkDamageMenu from './EncounterBulkDamageMenu.vue'
import EncounterChallengeMenu from './EncounterChallengeMenu.vue'
import EncounterScenarioCombatMenu from './EncounterScenarioCombatMenu.vue'
import SessionSelectionToolbar from './SessionSelectionToolbar.vue'
import { sessionShortcutLabels } from '../lib/sessionShortcuts'
const props=defineProps({sessionUuid:String,isDm:Boolean,encounter:{type:Object,required:true},selection:{type:Object,required:true},scene:Object,showShortcutHints:Boolean,transitioning:Boolean})
defineEmits(['toggle-combat','import-combat-block'])
const enc=props.encounter
const shortcutLabels=sessionShortcutLabels()
const combatItems=computed(()=>enc.sortable.displayItems('combat'))
const startSelectionCount=computed(()=>enc.inCombat.length)
const combatMoveCount=computed(()=>enc.selectedToMoveTo('combat'))
const deadMoveCount=computed(()=>enc.selectedToMoveTo('dead'))
</script>
<style scoped src="./styles/EncounterToolbar.css"></style>
