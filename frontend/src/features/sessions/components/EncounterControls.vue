<template>
  <div class="enc-toolbar">
    <BaseTile class="enc-control-panel" :outlined="false" role="group" aria-label="Управление боем">
      <div class="enc-phase-main">
        <header class="enc-toolbar-heading">
          <div class="enc-heading-identity" :class="{ 'enc-heading-identity--active': enc.encounter.active }">
            <h2>{{ enc.encounter.active ? 'Бой' : 'Подготовка' }}</h2>
            <span class="enc-heading-summary">
              <span class="enc-status" :class="{ 'enc-status--active': enc.encounter.active }" />
              {{ enc.inCombat.length }} на сцене
            </span>
          </div>
          <div v-if="enc.encounter.active" class="enc-round-wrap">
            <span class="enc-round-label">Раунд</span>
            <strong class="enc-round-num">{{ enc.encounter.round }}</strong>
          </div>
        </header>

        <div class="enc-phase-actions">
          <div v-if="enc.encounter.active" class="enc-turn-group" role="group" aria-label="Управление ходом">
            <button type="button" class="enc-icon-btn enc-icon-btn--prev" :disabled="enc.inCombat.length === 0" aria-label="Предыдущий ход" title="Предыдущий ход" aria-keyshortcuts="ArrowLeft" @click="enc.prevTurn">
              <ChevronLeft :size="18" aria-hidden="true" />
              <kbd v-if="showShortcutHints" class="enc-shortcut-hint" aria-hidden="true">←</kbd>
            </button>
            <button type="button" class="enc-icon-btn enc-icon-btn--next" :disabled="enc.inCombat.length === 0" aria-label="Следующий ход" title="Следующий ход" aria-keyshortcuts="ArrowRight" @click="enc.nextTurn">
              <span>Следующий</span>
              <ChevronRight :size="18" aria-hidden="true" />
              <kbd v-if="showShortcutHints" class="enc-shortcut-hint" aria-hidden="true">→</kbd>
            </button>
          </div>
          <button
            type="button"
            class="enc-icon-btn enc-battle-toggle"
            :class="enc.encounter.active ? 'enc-battle-toggle--end' : 'enc-battle-toggle--start'"
            :disabled="!enc.encounter.active && enc.inCombat.length === 0"
            :aria-label="enc.encounter.active ? 'Закончить бой' : 'Начать бой'"
            aria-keyshortcuts="Shift+Enter"
            @click="$emit('toggle-combat')"
          >
            <Square v-if="enc.encounter.active" :size="16" aria-hidden="true" />
            <Swords v-else :size="20" aria-hidden="true" />
            <span v-if="enc.encounter.active">Закончить бой</span>
            <span v-else>Начать<br />бой</span>
            <kbd v-if="showShortcutHints" class="enc-shortcut-hint" aria-hidden="true">{{ shortcutLabels.panel }}+Enter</kbd>
          </button>
        </div>
        <div v-if="isDm && scene" class="enc-scenario-action">
          <EncounterScenarioCombatMenu :session-uuid="sessionUuid" :scene="scene" @pick="$emit('import-combat-block', $event)" />
        </div>
      </div>
      <slot name="selection-panel" />
    </BaseTile>
  </div>
</template>
<script setup>
import { ChevronLeft, ChevronRight, Square, Swords } from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'
import EncounterScenarioCombatMenu from './EncounterScenarioCombatMenu.vue'
import { sessionShortcutLabels } from '../lib/sessionShortcuts'
const props=defineProps({sessionUuid:String,isDm:Boolean,encounter:{type:Object,required:true},scene:Object,showShortcutHints:Boolean})
defineEmits(['toggle-combat','import-combat-block'])
const enc=props.encounter
const shortcutLabels=sessionShortcutLabels()
</script>
<style scoped src="./styles/EncounterToolbar.css"></style>
