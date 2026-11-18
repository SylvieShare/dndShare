<template>
  <div
    class="enc-row-shell"
    :class="{ 'enc-row-shell--placeholder': enc.sortable.isSource(combatant), 'enc-row-shell--challenge': !!challengeResult }"
    :data-sortable-key="combatant.uid"
    :data-encounter-uid="combatant.uid"
    :data-encounter-section="section"
    @click.capture="onSelectionClick" @contextmenu.capture="onSelectionClick"
  >
    <div class="enc-row-main">
      <EncounterOrderMarker v-if="order != null" :order="order" :current="isCurrent" />
      <div class="enc-row-tile" :class="{ 'enc-row-tile--rough-edges': section === 'combat' }" :style="roughRowPaintStyle(idx, paintVariant)">
        <WorkspaceRowDivider v-if="divided" rough :rough-variant="idx" class="roster-divider" />
        <component :is="section === 'reserve-npc' ? SessionNpcTile : section === 'combat' ? SessionEncounterTile : SessionCombatantTile"
          class="enc-row" :class="rowClasses" :combatant="combatant" :section="section" :current="isCurrent"
          :selectable="showCheckbox" :editable="canEdit" :selected="enc.isSelected(combatant)"
          @select="enc.toggleSelected(combatant)" @pointerdown="onRowPointerDown"
          :tabindex="rowMenuVisible ? 0 : undefined" aria-haspopup="menu"
          @keydown.enter.self="onRowClick" @keydown.space.self.prevent="onRowClick"
          @click="onRowClick"
        />
        <Transition name="enc-row-roll" appear>
          <div v-if="challengeResult && !resultHidden" class="enc-row-roll-overlay" @pointerdown.stop @click.stop @contextmenu.stop @keydown.esc.stop.prevent="hideResult">
            <EncounterChallengeResult
              class="enc-row-result" :challenge="enc.challenge" :busy="enc.challengeBusy"
              :ability="challengeAbility" :result="challengeResult"
              @reroll="enc.rerollChallenge(combatant, $event)"
            />
          </div>
        </Transition>
        <button v-if="challengeResult" ref="resultToggle" class="enc-row-roll-toggle" type="button"
          :title="resultHidden ? 'Показать результат броска' : 'Скрыть результат броска'"
          :aria-label="resultHidden ? 'Показать результат броска' : 'Скрыть результат броска'"
          @pointerdown.stop @click.stop="resultHidden = !resultHidden">
          <Dices v-if="resultHidden" :size="14" /><ChevronRight v-else :size="14" />
        </button>
      </div>
    </div>

    <EncounterRowMenu
      v-if="rowMenuVisible"
      ref="rowMenuRef"
      :combatant="combatant"
      :section="section"
      :states-block="statesBlock"
      @edit-states="openStatesEditor"
      @edit-note="openNoteEditor"
      @view-participant="$emit('view-participant', $event)"
    />
  </div>

  <ItemPickerModal
    v-if="statesEditorOpen && statesBlock"
    :item-type-ids="[statesBlock.content.item_type_id]"
    :exclude-items="statesValue"
    :z-index="9200"
    title="Состояния"
    @close="statesEditorOpen = false"
    @pick="addState"
  />

  <AppModalFrame v-if="noteEditorOpen" :title="`Заметка — ${displayName}`" :z-index="9200" @close="cancelNoteEdit">
    <FormTextarea
      v-model:value="noteDraft"
      :rows="5"
      :maxlength="2000"
      placeholder="Заметка о существе"
    />
    <template #footer>
      <FormActionButtons
        submit-text="Сохранить"
        @cancel="cancelNoteEdit"
        @submit="commitNoteEdit"
      />
    </template>
  </AppModalFrame>
</template>

<script setup>
import { handleCtrlSelection } from '@/shared/lib/ctrlSelection'
import { computed, inject, nextTick, ref, watch } from 'vue'
import { ChevronRight, Dices } from '@lucide/vue'
import SessionCombatantTile from './SessionCombatantTile.vue'
import SessionNpcTile from './SessionNpcTile.vue'
import SessionEncounterTile from './SessionEncounterTile.vue'
import WorkspaceRowDivider from '@/shared/ui/WorkspaceRowDivider.vue'
import { roughRowPaintStyle } from '@/shared/ui/roughRowSeam'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import EncounterChallengeResult from '@/features/sessions/components/EncounterChallengeResult.vue'
import EncounterOrderMarker from '@/features/sessions/components/EncounterOrderMarker.vue'
import EncounterRowMenu from '@/features/sessions/components/EncounterRowMenu.vue'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { FormActionButtons } from '@sylvieshare/share-ui'
import { FormTextarea } from '@sylvieshare/share-ui'

const props = defineProps({
  combatant: { type: Object, required: true },
  section: { type: String, required: true },
  idx: { type: Number, default: -1 },
  order: { type: Number, default: null },
  isCurrent: { type: Boolean, default: false },
  divided: Boolean,
})

defineEmits(['view-participant'])

const enc = inject('encounter')
const paintVariant = computed(() => {
  if (props.section === 'combat') return 'scene'
  return props.section === 'reserve-npc' && !props.divided ? 'flatTop' : 'seam'
})

const isPlayer = computed(() => props.combatant.type === 'player')
const displayName = computed(() =>
  isPlayer.value ? enc.playerDisplayName(props.combatant) : enc.npcName(props.combatant)
)

const challengeResult = computed(() =>
  props.combatant.position !== 'dead' ? enc.challengeResult(props.combatant) : null
)
const resultHidden = ref(false), resultToggle = ref(null)
function hideResult() { resultHidden.value = true; nextTick(() => resultToggle.value?.focus()) }
watch(challengeResult, () => { resultHidden.value = false })
const challengeAbility = computed(() => enc.challengeAbilityMeta(enc.challenge?.ability))

const skippedInTurn = computed(() =>
  props.section === 'combat' && enc.encounter.active && !enc.isActiveInTurn(props.combatant)
)

const rowClasses = computed(() => ({
  'enc-row--current': props.isCurrent,
  'enc-row--challenge': !!challengeResult.value,
  'enc-row--placeholder': enc.sortable.isSource(props.combatant),
  'enc-row--skipped': skippedInTurn.value && props.combatant.position !== 'dead',
  'enc-row--defeated': props.combatant.position === 'dead',
}))

// The whole row is a drag handle now. Bail when the pointer lands on an
// interactive control so clicks/typing still work there.
const DRAG_IGNORE = 'input, textarea, button, a, [role="button"], .p-combat-controls, .enc-hp-area, .p-statuses-area'
function onRowPointerDown(e) {
  if (props.combatant.position === 'dead' || e.ctrlKey || e.metaKey) return
  if (e.button !== undefined && e.button !== 0) return
  if (e.target.closest(DRAG_IGNORE)) return
  enc.sortable.startDrag(e, props.combatant, props.section, props.idx)
}

const showCheckbox = computed(() => !!enc.canEditPlayerHp())

const statesBlock = computed(() => enc.statesBlock(props.combatant))
const statesValue = computed(() => enc.statesValue(props.combatant))

const canEdit = computed(() => !!enc.canEditPlayerHp())
const rowMenuVisible = computed(() => canEdit.value)
const rowMenuRef = ref(null)

function onSelectionClick(event) {
  if (event.target.closest('.p-statuses-area,.roster-select-zone')) return
  handleCtrlSelection(event, showCheckbox.value, () => enc.toggleSelected(props.combatant))
}

function onRowClick(event) {
  if (!rowMenuVisible.value || enc.sortable.shouldSuppressClick()) return
  if (event.target?.closest?.(DRAG_IGNORE) && !event.target.closest('.portrait')) return
  rowMenuRef.value?.toggle(event.currentTarget)
}

const statesEditorOpen = ref(false)

function openStatesEditor() {
  statesEditorOpen.value = true
}

function addState(item) {
  enc.setStates(props.combatant, [...statesValue.value, item.id])
  statesEditorOpen.value = false
}

const noteEditorOpen = ref(false)
const noteDraft = ref('')

function openNoteEditor() {
  noteDraft.value = props.combatant.note || ''
  noteEditorOpen.value = true
}

function cancelNoteEdit() {
  noteEditorOpen.value = false
}

function commitNoteEdit() {
  enc.setNote(props.combatant, noteDraft.value.trim())
  noteEditorOpen.value = false
}
</script>

<style scoped>
.enc-row-shell { position:relative;display: flex; min-width: 0; align-items: stretch; }
.roster-divider {z-index:2}
.enc-row-main { display: flex; align-items: stretch; gap: 10px; min-width: 0; flex: 1; max-width: var(--enc-roster-width, 480px); }
.enc-row-tile { position: relative; flex: 1; min-width: 0; overflow: hidden; border-radius: var(--r-lg); }
.enc-row-roll-overlay { position: absolute; z-index: 2; inset: 2px 2px 2px auto; width: min(248px, calc(100% - 40px)); display: flex; align-items: center; overflow: hidden; border-radius: 0 calc(var(--r-lg) - 2px) calc(var(--r-lg) - 2px) 0; background: var(--surface); box-shadow: -8px 0 16px color-mix(in srgb, var(--scrim) 20%, transparent); }
.enc-row-result { width: 100%; }
.enc-row-tile:has(:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
.enc-row-shell[data-encounter-section="combat"] .enc-row-tile,.enc-row-shell[data-encounter-section="reserve-npc"] .enc-row-tile {border-radius:0;overflow:visible}
.enc-row-tile--rough-edges :deep(.session-roster-tile.base-tile) {box-shadow:none}
.enc-row-tile--rough-edges :deep(.roster-color-edge) {display:block}
.enc-row-shell--placeholder .enc-row-roll-overlay, .enc-row-shell--placeholder .enc-row-roll-toggle { visibility: hidden; }
.enc-row-roll-toggle { position: absolute; right: 4px; bottom: 3px; z-index: 3; display: grid; place-items: center; width: 22px; height: 18px; padding: 0; border: 0; border-radius: var(--r-sm); background: var(--surface-raised); color: var(--text-muted); cursor: pointer; transition: color .16s, background .16s; }
.enc-row-roll-toggle:hover { color: var(--accent); background: var(--surface-active); }
.enc-row-roll-enter-active, .enc-row-roll-leave-active { transition: transform .26s cubic-bezier(.22,1,.36,1), opacity .18s; }
.enc-row-roll-enter-from, .enc-row-roll-leave-to { transform: translateX(105%); opacity: 0; }
.enc-row-roll-leave-active { pointer-events: none; }
@media (prefers-reduced-motion: reduce) {
  .enc-row-roll-enter-active, .enc-row-roll-leave-active, .enc-row-roll-toggle { transition: none; }
  .enc-row-roll-enter-from, .enc-row-roll-leave-to { transform: none; opacity: 1; }
}
.enc-row-shell[data-encounter-section="combat"] { width: 100%; max-width: 100%; }
.enc-row-shell--placeholder :deep(.enc-row-order) { opacity: .25; }
.enc-row { flex: 1; cursor: grab; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
.enc-row--placeholder { cursor: grabbing; }
.enc-row--defeated { cursor: pointer; }
.enc-row:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.enc-row.enc-row--placeholder { border: 2px dashed var(--accent); }
.enc-row--placeholder :deep(*) { visibility: hidden; }
.enc-row--skipped { opacity: .5; }
.enc-row--skipped.enc-row--current { opacity: 1; }
</style>
