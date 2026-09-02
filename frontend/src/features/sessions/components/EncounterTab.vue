<template>
  <div
    ref="encounterRoot"
    class="enc-wrap"
    :class="{
      'enc-wrap--workspace': workspace,
      'enc-wrap--combat-starting': combatTransitionPhase === 'starting',
      'enc-wrap--combat-ending': combatTransitionPhase === 'ending',
    }"
  >

    <BaseTile class="enc-toolbar">
      <div class="enc-workspace-heading">
        <div class="enc-context-icon" :class="{ 'enc-context-icon--image': contextImageUrl }">
          <img v-if="contextImageUrl" :src="contextImageUrl" alt="" />
          <Clapperboard v-else-if="scene" :size="22" />
          <BookOpenText v-else :size="22" />
        </div>
        <div class="enc-context-copy">
          <span>{{ contextKind }}</span>
          <strong :title="contextTitle">{{ contextTitle }}</strong>
          <small>{{ encounterSummary }}</small>
        </div>
      </div>

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

      <div class="enc-toolbar-actions">
        <div v-if="props.isDm" class="enc-action-group" aria-label="Броски">
          <span class="enc-action-group-label">Броски</span>
          <div class="enc-action-group-controls">
            <EncounterChallengeMenu />
            <button
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
          </div>
        </div>
        <div v-if="props.isDm" class="enc-action-group" aria-label="Действия с выбранными участниками">
          <span class="enc-action-group-label">Выбранные</span>
          <div class="enc-action-group-controls">
            <EncounterBulkDamageMenu />
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
    </BaseTile>

    <div class="enc-content">
    <!-- ── Combat ── -->
    <Transition name="enc-combat-scene">
      <div v-if="enc.encounter.active" class="enc-combat-scene">
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

    <!-- ── NPC reserve ── -->
    <div class="enc-block enc-block--npc" :class="{ 'enc-block--disabled': enc.npcReserveCollapsed }">
      <div class="enc-section-title-row">
        <div class="enc-section-title-group">
          <span class="enc-section-title">
            <span class="enc-section-dot" />ЗАПАС НПС<span v-if="enc.npcReserveCollapsed" class="enc-section-disabled-hint"> · недоступно для игроков</span>
          </span>
          <button
            type="button"
            class="enc-section-icon-btn"
            :class="{ 'enc-section-icon-btn--active': allSelectedInNpcs }"
            :disabled="npcItems.length === 0"
            :title="allSelectedInNpcs ? 'Снять выбор' : 'Выбрать весь запас'"
            :aria-label="allSelectedInNpcs ? 'Снять выбор' : 'Выбрать весь запас'"
            aria-keyshortcuts="Shift+N"
            @click="enc.selectAllInGroup('reserve-npc')"
          >
            <ListChecks :size="17" />
            <kbd v-if="showShortcutHints" class="enc-shortcut-hint" aria-hidden="true">{{ shortcutLabels.panel }}+N</kbd>
          </button>
        </div>
      </div>
      <div class="enc-section">
        <div
          v-if="npcItems.length"
          class="enc-reserve-list"
          data-sortable-container="reserve-npc"
        >
          <EncounterRow
            v-for="c in npcItems"
            :key="c.uid"
            :combatant="c"
            section="reserve-npc"
          />
        </div>
        <div
          v-else-if="!enc.npcReserveCollapsed"
          class="enc-reserve-empty"
          data-sortable-container="reserve-npc"
        >Запас пуст</div>
        <div class="enc-add-row">
          <button class="enc-add-dashed" @click="enc.showNpcPicker = true"><BookOpen :size="17" />Добавить из бестиария</button>
          <button class="enc-add-dashed enc-add-dashed--simple" @click="enc.showSimpleForm = true"><Plus :size="17" />Создать упрощённо</button>
        </div>
      </div>
    </div>
    </div>

    <ItemPickerModal
      v-if="enc.showNpcPicker"
      :item-type-ids="[6]"
      title="Бестиарий"
      search-placeholder="Поиск существ..."
      allow-quantity
      create-show-name-en
      @close="enc.showNpcPicker = false"
      @pick="enc.addNpc"
    />

    <AppModalFrame v-if="enc.showSimpleForm" title="Своё существо" @close="enc.showSimpleForm = false">
      <FormField label="Имя" vertical>
        <FormTextInput v-model:value="simpleForm.name" placeholder="Гоблин-вожак" autofocus @enter="submitSimple" />
      </FormField>
      <div class="simple-grid">
        <FormField label="Класс брони" vertical>
          <FormNumberInput :value="simpleForm.ac" :min="0" :max="99" @change="simpleForm.ac = $event" />
        </FormField>
        <FormField label="Текущие HP" vertical>
          <FormNumberInput :value="simpleForm.hp" :min="0" :max="9999" @change="onSimpleHp" />
        </FormField>
        <FormField label="Максимум HP" vertical>
          <FormNumberInput :value="simpleForm.hpMax" :min="0" :max="9999" @change="simpleForm.hpMax = $event" />
        </FormField>
      </div>
      <FormField label="Описание" vertical>
        <FormTextarea v-model:value="simpleForm.description" :rows="3" :maxlength="2000" placeholder="Краткое описание" />
      </FormField>
      <template #footer>
        <FormActionButtons
          submit-text="Добавить"
          :can-submit="!!simpleForm.name.trim()"
          @cancel="enc.showSimpleForm = false"
          @submit="submitSimple"
        />
      </template>
    </AppModalFrame>
    <DndHpCalcModal
      v-if="enc.hpCalcNpc"
      :hp="enc.npcHpObj(enc.hpCalcNpc)"
      is-npc
      @close="enc.closeHpCalc"
      @change="enc.onNpcHpChange"
      @graveyard="onNpcGraveyard"
    />
    <DndHpCalcModal
      v-if="enc.hpCalcPlayer"
      :hp="enc.playerHpObj(enc.hpCalcPlayer)"
      @close="enc.closeHpCalcPlayer"
      @change="enc.onPlayerHpChange"
    />

    <ItemViewModal
      v-if="enc.detailNpc && enc.detailNpc.itemId != null"
      :item-type-id="6"
      :item-id="enc.detailNpc.itemId"
      :item="enc.npcItem(enc.detailNpc) ?? null"
      :actor-name="enc.npcActorName(enc.detailNpc)"
      @close="enc.closeNpcDetail"
    />

    <AppModalFrame v-if="enc.hpEditNpc" :title="`${enc.npcName(enc.hpEditNpc)} · хиты`" @close="enc.closeNpcHpEdit">
      <FormField label="Текущие HP">
        <FormNumberInput :value="enc.hpEditNpc.hpCurrent ?? 0" :min="0" :max="999" @change="enc.setNpcHpField('current', $event)" />
      </FormField>
      <FormField label="Максимум HP">
        <FormNumberInput :value="enc.npcHpMax(enc.hpEditNpc)" :min="0" :max="999" @change="enc.setNpcHpField('max', $event)" />
      </FormField>
      <FormField label="Временные HP">
        <FormNumberInput :value="enc.hpEditNpc.hpTemp ?? 0" :min="0" :max="999" @change="enc.setNpcHpField('temp', $event)" />
      </FormField>
    </AppModalFrame>
  </div>
</template>

<script setup>
import { computed, provide, reactive, ref } from 'vue'
import {
  ArchiveRestore,
  BookOpen,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Dices,
  ListChecks,
  LogIn,
  Plus,
  Skull,
  Square,
  Swords,
  Trash2,
} from '@lucide/vue'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { BaseTile } from '@sylvieshare/share-ui'
import DndHpCalcModal from '@/features/character-editor/blocks/dnd/DndHpCalcModal'
import EncounterBulkDamageMenu from '@/features/sessions/components/EncounterBulkDamageMenu.vue'
import EncounterChallengeMenu from '@/features/sessions/components/EncounterChallengeMenu.vue'
import EncounterGraveyardMenu from '@/features/sessions/components/EncounterGraveyardMenu.vue'
import EncounterRow from '@/features/sessions/components/EncounterRow'
import { useEncounterCombatTransition } from '@/features/sessions/composables/useEncounterCombatTransition'
import { currentChapterLabel } from '@/features/sessions/lib/chapterGraph'
import { sessionImageUrl } from '@/features/sessions/lib/sessionImages'
import { sessionShortcutLabels } from '@/features/sessions/lib/sessionShortcuts'
import { FormActionButtons } from '@sylvieshare/share-ui'
import { FormField } from '@sylvieshare/share-ui'
import { FormNumberInput } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'
import { FormTextarea } from '@sylvieshare/share-ui'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'

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
defineEmits(['view-participant'])

const enc = props.encounter
const shortcutLabels = sessionShortcutLabels()
const encounterRoot = ref(null)

const {
  transitioning: combatTransitioning,
  phase: combatTransitionPhase,
  toggleCombat,
} = useEncounterCombatTransition(enc, encounterRoot)

provide('encounter', enc)

const combatItems = computed(() => enc.sortable.displayItems('combat'))
const npcItems = computed(() => enc.sortable.displayItems('reserve-npc'))

const currentTurnUid = computed(() => enc.currentTurnUid)

const startSelectionCount = computed(() => enc.selectedRerollCount)
const combatMoveCount = computed(() => enc.selectedToMoveTo('combat'))
const reserveMoveCount = computed(() => enc.selectedToMoveTo('reserve'))
const deadMoveCount = computed(() => enc.selectedToMoveTo('dead'))
const contextEntity = computed(() => props.scene || props.chapter)
const contextImageUrl = computed(() => sessionImageUrl(contextEntity.value))
const contextKind = computed(() => props.scene ? 'Сценарий' : props.chapter ? 'Глава' : 'Сессия')
const contextTitle = computed(() => props.scene?.name || currentChapterLabel(props.chapter) || props.session.name)
const allSelectedInCombat = computed(() =>
  combatItems.value.length > 0 && combatItems.value.every(combatant => enc.isSelected(combatant))
)
const allSelectedInNpcs = computed(() =>
  npcItems.value.length > 0 && enc.selectedCountInGroup('reserve-npc') === npcItems.value.length
)

const encounterSummary = computed(() => {
  if (enc.encounter.active) return `Раунд ${enc.encounter.round} · ${enc.inCombat.length} участников`
  if (startSelectionCount.value) return `Выбрано участников: ${startSelectionCount.value}`
  return `${npcItems.value.length} существ в запасе`
})

function toggleVisibleSelection(items) {
  const shouldSelect = !items.every(combatant => enc.isSelected(combatant))
  for (const combatant of items) {
    if (enc.isSelected(combatant) !== shouldSelect) enc.toggleSelected(combatant)
  }
}

function onNpcGraveyard() {
  const c = enc.hpCalcNpc
  if (!c) return
  enc.sendToGraveyard(c)
  enc.closeHpCalc()
}

const simpleForm = reactive({ name: '', ac: 0, hp: 0, hpMax: 0, description: '' })

function onSimpleHp(val) {
  simpleForm.hp = val
  if (!simpleForm.hpMax || simpleForm.hpMax < val) simpleForm.hpMax = val
}

function submitSimple() {
  if (!simpleForm.name.trim()) return
  enc.addSimpleNpc({ ...simpleForm })
  enc.showSimpleForm = false
  simpleForm.name = ''
  simpleForm.ac = 0
  simpleForm.hp = 0
  simpleForm.hpMax = 0
  simpleForm.description = ''
}

defineExpose({ toggleCombat })
</script>

<style scoped src="./styles/EncounterTab.css"></style>
