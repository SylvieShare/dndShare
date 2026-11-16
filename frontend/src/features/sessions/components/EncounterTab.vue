<template>
  <div
    ref="encounterRoot"
    class="enc-wrap"
    :class="{
      'enc-wrap--workspace': workspace,
      'enc-wrap--narrow': !hasPreviewSpace,
      'enc-wrap--compact-roster': compactRoster,
      'enc-wrap--combat-starting': combatTransitionPhase === 'starting',
      'enc-wrap--combat-ending': combatTransitionPhase === 'ending',
    }"
  >

    <BaseTile ref="encounterToolbar" class="enc-toolbar">
      <div class="enc-context-art" :class="{ 'enc-context-art--image': contextImageUrl }">
        <img v-if="contextImageUrl" :src="contextImageUrl" alt="" />
        <Clapperboard v-else-if="scene" :size="36" />
        <BookOpenText v-else :size="36" />
        <div class="enc-context-art-copy">
          <span :title="contextParentTitle">{{ contextParentTitle }}</span>
          <strong :title="contextTitle">{{ contextTitle }}</strong>
        </div>
      </div>

      <div class="enc-toolbar-body">
        <div class="enc-toolbar-top">
          <div class="enc-toolbar-flow" aria-label="Управление боем">
            <button
              type="button"
              class="enc-icon-btn enc-icon-btn--primary"
              :class="{ 'enc-icon-btn--end': enc.encounter.active }"
              :disabled="combatTransitioning || (!enc.encounter.active && startSelectionCount === 0)"
              :title="enc.encounter.active ? 'Закончить бой' : `Начать бой (${startSelectionCount})`"
              :aria-label="enc.encounter.active ? 'Закончить бой' : 'Начать бой'"
              aria-keyshortcuts="Shift+Enter"
              @click="toggleCombat"
            >
              <Square v-if="enc.encounter.active" :size="22" />
              <Swords v-else :size="23" />
              <span class="enc-primary-label">{{ enc.encounter.active ? 'Закончить бой' : 'Начать бой' }}</span>
              <span v-if="!enc.encounter.active && startSelectionCount" class="enc-icon-count">{{ startSelectionCount }}</span>
              <kbd v-if="showShortcutHints" class="enc-shortcut-hint" aria-hidden="true">{{ shortcutLabels.panel }}+Enter</kbd>
            </button>

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
              <Dices :size="18" />
              <span v-if="enc.selectedRerollCount" class="enc-icon-count">{{ enc.selectedRerollCount }}</span>
              <kbd v-if="showShortcutHints" class="enc-shortcut-hint" aria-hidden="true">{{ shortcutLabels.panel }}+R</kbd>
            </button>

            <template v-if="enc.encounter.active">
              <div class="enc-round-wrap" title="Текущий раунд">
                <span class="enc-round-label">Раунд</span>
                <span class="enc-round-num">{{ enc.encounter.round }}</span>
              </div>
              <div class="enc-turn-group">
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
          <span class="enc-combat-summary">{{ encounterSummary }}</span>
        </div>

        <div class="enc-toolbar-actions">
          <div v-if="props.isDm" class="enc-action-group" aria-label="Действия с выбранными участниками">
            <span class="enc-action-group-label">Выбранные</span>
            <div class="enc-action-group-controls">
              <EncounterChallengeMenu />
              <EncounterBulkDamageMenu />
            </div>
          </div>
          <div v-if="props.isDm" class="enc-action-group" aria-label="Состав сцены">
            <span class="enc-action-group-label">Состав сцены</span>
            <div class="enc-action-group-controls">
              <EncounterScenarioCombatMenu
                v-if="props.isDm && scene"
                :session-uuid="sessionUuid"
                :scene="scene"
                @pick="$emit('import-combat-block', $event)"
              />
              <button
                type="button"
                class="enc-icon-btn"
                :disabled="reserveMoveCount === 0"
                title="Вернуть выбранных в запас"
                aria-label="Вернуть выбранных в запас"
                @click="enc.sendSelectedTo('reserve')"
              >
                <ArchiveRestore :size="18" />
                <span v-if="reserveMoveCount" class="enc-icon-count">{{ reserveMoveCount }}</span>
              </button>
              <button
                type="button"
                class="enc-icon-btn enc-icon-btn--danger"
                :disabled="deadMoveCount === 0"
                title="Убить выбранных — переместить на кладбище"
                aria-label="Убить выбранных — переместить на кладбище"
                @click="enc.sendSelectedTo('dead')"
              >
                <Skull :size="18" />
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
                <span v-if="enc.selectedNpcCount" class="enc-icon-count">{{ enc.selectedNpcCount }}</span>
                <kbd v-if="showShortcutHints" class="enc-shortcut-hint" aria-hidden="true">⌫</kbd>
              </button>
              <EncounterGraveyardMenu :is-dm="props.isDm" @view-participant="$emit('view-participant', $event)" />
            </div>
          </div>
        </div>
      </div>
    </BaseTile>

    <div
      class="enc-content enc-content--combat-active"
    >
      <div
        class="enc-combat-layout enc-combat-layout--active"
        :class="{ 'enc-combat-layout--preview': enc.encounter.active && hasPreviewSpace }"
      >
        <div class="enc-combat-primary">
          <!-- ── Combat ── -->
          <Transition name="enc-combat-scene">
            <div class="enc-combat-scene">
              <div class="enc-block enc-block--combat">
                <div class="enc-section-title-row">
                  <div class="enc-section-title-group">
                    <span class="enc-section-title">
                      <span class="enc-section-dot" />БОЕВАЯ СЦЕНА
                    </span>
                    <button
                      type="button"
                      class="enc-section-icon-btn"
                      :class="{ 'enc-section-icon-btn--active': allSelectedInCombat }"
                      :disabled="combatItems.length === 0"
                      :title="allSelectedInCombat ? 'Снять выбор с существ' : 'Выбрать всех существ'"
                      :aria-label="allSelectedInCombat ? 'Снять выбор с существ' : 'Выбрать всех существ'"
                      aria-keyshortcuts="Shift+A"
                      @click="toggleVisibleSelection(combatItems)"
                    >
                      <ListChecks :size="17" />
                      <kbd v-if="showShortcutHints" class="enc-shortcut-hint" aria-hidden="true">{{ shortcutLabels.panel }}+A</kbd>
                    </button>
                  </div>
                  <div class="enc-section-actions">
                    <button
                      v-if="enc.encounter.active"
                      type="button"
                      class="enc-section-icon-btn enc-section-icon-btn--accent"
                      :disabled="combatMoveCount === 0 || !props.isDm"
                      title="Добавить выбранных на сцену"
                      aria-label="Добавить выбранных на сцену"
                      @click="enc.sendSelectedTo('combat')"
                    >
                      <LogIn :size="17" />
                      <span v-if="combatMoveCount">{{ combatMoveCount }}</span>
                    </button>
                  </div>
                </div>
                <div class="enc-section">
                  <div
                    v-if="combatItems.length === 0"
                    class="enc-empty"
                    data-sortable-container="combat"
                  >
                    {{ enc.encounter.active
                        ? 'На боевой сцене пока нет участников'
                        : 'Выберите игроков и существ, затем начните бой' }}
                  </div>
                  <div
                    v-else
                    class="enc-rows"
                    data-sortable-container="combat"
                  >
                    <EncounterRow
                      v-for="(c, idx) in combatItems"
                      :key="c.uid"
                      :combatant="c"
                      section="combat"
                      :idx="idx"
                      :order="idx + 1"
                      :is-current="enc.encounter.active && c.uid === currentTurnUid"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Transition>


        </div>

        <Transition name="enc-turn-preview" :css="hasPreviewSpace">
          <EncounterTurnPreview
            v-if="enc.encounter.active && hasPreviewSpace"
            :combatant="currentTurnCombatant"
            @view-participant="$emit('view-participant', $event)"
          />
        </Transition>
      </div>
    </div>


  </div>
</template>

<script setup>
import { computed, provide, ref } from 'vue'
import {
  ArchiveRestore,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Dices,
  ListChecks,
  LogIn,
  Skull,
  Square,
  Swords,
  Trash2,
} from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'
import EncounterBulkDamageMenu from '@/features/sessions/components/EncounterBulkDamageMenu.vue'
import EncounterChallengeMenu from '@/features/sessions/components/EncounterChallengeMenu.vue'
import EncounterGraveyardMenu from '@/features/sessions/components/EncounterGraveyardMenu.vue'
import EncounterRow from '@/features/sessions/components/EncounterRow'
import EncounterScenarioCombatMenu from '@/features/sessions/components/EncounterScenarioCombatMenu.vue'
import EncounterTurnPreview from '@/features/sessions/components/EncounterTurnPreview.vue'
import { useEncounterCombatTransition } from '@/features/sessions/composables/useEncounterCombatTransition'
import { useEncounterWorkspaceLayout } from '@/features/sessions/composables/useEncounterWorkspaceLayout'
import { currentChapterLabel } from '@/features/sessions/lib/chapterGraph'
import { sessionImageUrl } from '@/features/sessions/lib/sessionImages'
import { sessionShortcutLabels } from '@/features/sessions/lib/sessionShortcuts'

const props = defineProps({
  sessionUuid: { type: String, required: true },
  session: { type: Object, required: true },
  participants: { type: Array, default: () => [] },
  isDm: { type: Boolean, default: false },
  workspace: { type: Boolean, default: false },
  encounter: { type: Object, required: true },
  chapter: { type: Object, default: null },
  scene: { type: Object, default: null },
  showShortcutHints: { type: Boolean, default: false },
})
defineEmits(['view-participant', 'import-combat-block'])

const enc = props.encounter
const shortcutLabels = sessionShortcutLabels()
const encounterRoot = ref(null)
const encounterToolbar = ref(null)
const { hasPreviewSpace, compactRoster } = useEncounterWorkspaceLayout(encounterRoot, encounterToolbar, () => props.workspace)

const {
  transitioning: combatTransitioning,
  phase: combatTransitionPhase,
  toggleCombat,
} = useEncounterCombatTransition(enc, encounterRoot)

provide('encounter', enc)

const combatItems = computed(() => enc.sortable.displayItems('combat'))

const currentTurnUid = computed(() => enc.currentTurnUid)
const currentTurnCombatant = computed(() => enc.inCombat.find(combatant => combatant.uid === currentTurnUid.value) ?? null)

const startSelectionCount = computed(() => enc.inCombat.length + enc.encounter.combatants.filter(row => row.position !== 'combat' && row.position !== 'dead' && enc.isSelected(row)).length)
const combatMoveCount = computed(() => enc.selectedToMoveTo('combat'))
const reserveMoveCount = computed(() => enc.selectedToMoveTo('reserve'))
const deadMoveCount = computed(() => enc.selectedToMoveTo('dead'))
const contextEntity = computed(() => props.scene || props.chapter)
const contextImageUrl = computed(() => sessionImageUrl(contextEntity.value))
const contextKind = computed(() => props.scene ? 'Сценарий' : props.chapter ? 'Глава' : 'Сессия')
const contextTitle = computed(() => props.scene?.name || currentChapterLabel(props.chapter) || props.session.name)
const contextParentTitle = computed(() => props.scene
  ? currentChapterLabel(props.chapter) || props.session.name
  : contextKind.value)
const allSelectedInCombat = computed(() =>
  combatItems.value.length > 0 && combatItems.value.every(combatant => enc.isSelected(combatant))
)


const encounterSummary = computed(() => {
  if (enc.encounter.active) return `Раунд ${enc.encounter.round} · ${enc.inCombat.length} участников`
  if (startSelectionCount.value) return `Выбрано участников: ${startSelectionCount.value}`
  return `${enc.allReserveNpcs.length} существ в запасе`
})

function toggleVisibleSelection(items) {
  const shouldSelect = !items.every(combatant => enc.isSelected(combatant))
  for (const combatant of items) {
    if (enc.isSelected(combatant) !== shouldSelect) enc.toggleSelected(combatant)
  }
}

defineExpose({ toggleCombat })
</script>

<style scoped src="./styles/EncounterToolbar.css"></style>
<style scoped src="./styles/EncounterTab.css"></style>
