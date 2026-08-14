<template>
  <div
    class="enc-row-shell"
    :class="{ 'enc-row-shell--placeholder': enc.sortable.isSource(combatant) }"
    :data-sortable-key="combatant.uid"
  >
    <EncounterOrderMarker
      v-if="order != null"
      :order="order"
      :current="isCurrent"
    />

    <BaseTile
      class="enc-row"
      :class="rowClasses"
      color="var(--section-color)"
      strip
      @pointerdown="onRowPointerDown"
    >
    <EncounterCombatControls
      :combatant="combatant"
      :selected="enc.isSelected(combatant)"
      :editable="showCheckbox"
      :show-checkbox="showCheckbox"
      :armor-class="enc.displayAc(combatant)"
      :current="isCurrent"
      @update:selected="enc.toggleSelected(combatant)"
      @update:initiative="enc.setInitiative(combatant, $event)"
    />

    <EncounterAvatar :combatant="combatant" />

    <div class="enc-info">
      <div class="enc-name-row">
        <EncounterMarkerMenu v-if="isNpc" :combatant="combatant" :editable="showCheckbox" />
        <span
          class="enc-name"
          :class="{ 'enc-name--clickable': isNpc && hasItem }"
          @click="isNpc && hasItem && enc.openNpcDetail(combatant)"
        >{{ displayName }}</span>
        <ParticipantColorTicks v-if="playerColor" :color="playerColor" />
        <span
          v-if="isNpc"
          ref="badgeEl"
          class="enc-badge"
          :class="[enc.badgeClass(combatant), { 'enc-badge--clickable': isNpc }]"
          @click="onBadgeClick"
        >{{ enc.badgeLabel(combatant) }}</span>
        <template v-if="section === 'combat'">
          <span
            v-if="!enc.encounter.active"
            class="enc-surprised-toggle"
            :class="{ active: combatant.surprised }"
            @click="enc.toggleSurprised(combatant)"
          >врасплох</span>
          <span
            v-else-if="enc.encounter.round === 0 && combatant.surprised"
            class="enc-surprised-chip"
          >врасплох</span>
        </template>
        <BlockStates
          v-if="statesBlock"
          class="enc-states"
          :block="statesBlock"
          :value="statesValue"
          @update:value="onStatesUpdate"
        />
        <span v-if="isNpc && combatant.note" class="enc-note" :title="combatant.note">{{ combatant.note }}</span>
      </div>
      <EncounterHpBar class="enc-info-hp" :combatant="combatant" :section="section" />
      <div v-if="subtitleText" class="enc-sub">{{ subtitleText }}</div>
    </div>

    <button
      v-if="canRollNpcHp"
      type="button"
      class="enc-hp-dice-btn"
      :title="`Бросить хиты (${npcFormula})`"
      @click.stop="enc.rollNpcHpFromFormula(combatant)"
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.2l5.6 3.2v7.2L8 14.8 2.4 11.6V4.4L8 1.2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
        <circle cx="8" cy="8" r="1.1" fill="currentColor"/>
        <circle cx="5.4" cy="6.2" r="0.8" fill="currentColor"/>
        <circle cx="10.6" cy="9.8" r="0.8" fill="currentColor"/>
      </svg>
    </button>

    <EncounterRowMenu
      v-if="rowMenuVisible"
      :combatant="combatant"
      :section="section"
      :states-block="statesBlock"
      @edit-states="openStatesEditor"
      @edit-note="openNoteEditor"
    />
    </BaseTile>
  </div>

  <BasePopover v-if="isNpc" v-model:open="sideMenuOpen" :anchor="badgeEl" :min-width="160">
    <button
      v-for="opt in enc.SIDE_OPTIONS"
      :key="opt.value"
      type="button"
      class="enc-popover-item"
      :class="[`enc-popover-item--${opt.value}`, { 'enc-popover-item--active': enc.badgeLabel(combatant) === opt.label.toUpperCase() || combatant.side === opt.value }]"
      @click="pickSide(opt.value)"
    >{{ opt.label }}</button>
  </BasePopover>

  <SuggestMultiSelect
    v-if="statesEditorOpen && statesBlock"
    :suggest-type-id="statesBlock.content.suggest_id"
    :items="statesAllItems"
    :active-ids="statesValue"
    title="Статусы"
    @toggle="onStatesToggle"
    @close="statesEditorOpen = false"
    @created="onStatesCreated"
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
import { computed, inject, provide, reactive, ref } from 'vue'
import BlockStates from '@/features/character-editor/blocks/generic/BlockStates'
import EncounterAvatar from '@/features/sessions/components/EncounterAvatar.vue'
import EncounterCombatControls from '@/features/sessions/components/EncounterCombatControls.vue'
import EncounterHpBar from '@/features/sessions/components/EncounterHpBar.vue'
import EncounterMarkerMenu from '@/features/sessions/components/EncounterMarkerMenu.vue'
import EncounterOrderMarker from '@/features/sessions/components/EncounterOrderMarker.vue'
import EncounterRowMenu from '@/features/sessions/components/EncounterRowMenu.vue'
import ParticipantColorTicks from '@/features/sessions/components/ParticipantColorTicks.vue'
import AppModalFrame from '@/shared/ui/AppModalFrame.vue'
import BasePopover from '@/shared/ui/BasePopover.vue'
import BaseTile from '@/shared/ui/BaseTile.vue'
import FormActionButtons from '@/shared/ui/form/FormActionButtons'
import FormTextarea from '@/shared/ui/form/FormTextarea'
import SuggestMultiSelect from '@/shared/ui/SuggestMultiSelect'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  combatant: { type: Object, required: true },
  section: { type: String, required: true },
  idx: { type: Number, default: -1 },
  order: { type: Number, default: null },
  isCurrent: { type: Boolean, default: false },
})

const enc = inject('encounter')

const isPlayer = computed(() => props.combatant.type === 'player')
const isNpc = computed(() => props.combatant.type === 'npc')
const playerColor = computed(() => isPlayer.value ? enc.participantColor(props.combatant.charId) : null)

const displayName = computed(() =>
  isPlayer.value ? enc.playerDisplayName(props.combatant) : enc.npcName(props.combatant)
)

const hasItem = computed(() => isNpc.value && props.combatant.itemId != null)

const subtitleText = computed(() => enc.subtitle(props.combatant))

const skippedInTurn = computed(() =>
  props.section === 'combat' && enc.encounter.active && !enc.isActiveInTurn(props.combatant)
)

const rowClasses = computed(() => ({
  'enc-row--current': props.isCurrent,
  'enc-row--placeholder': enc.sortable.isSource(props.combatant),
  'enc-row--skipped': skippedInTurn.value,
}))

// The whole row is a drag handle now. Bail when the pointer lands on an
// interactive control so clicks/typing still work there.
const DRAG_IGNORE = 'input, textarea, button, a, [role="button"], .enc-combat-controls, .enc-hp-area, .enc-badge, .enc-surprised-toggle, .enc-states, .enc-name--clickable'
function onRowPointerDown(e) {
  if (e.button !== undefined && e.button !== 0) return
  if (e.target.closest(DRAG_IGNORE)) return
  enc.sortable.startDrag(e, props.combatant, props.section, props.idx)
}

const npcFormula = computed(() => isNpc.value ? enc.npcHpFormula(props.combatant) : '')
const canRollNpcHp = computed(() => isNpc.value && props.section !== 'combat' && !!npcFormula.value)

const showCheckbox = computed(() => !!enc.canEditPlayerHp())

const badgeEl = ref(null)
const sideMenuOpen = ref(false)

function onBadgeClick() {
  if (!isNpc.value) return
  sideMenuOpen.value = true
}

function pickSide(side) {
  enc.setSide(props.combatant, side)
  sideMenuOpen.value = false
}

const statesBlock = computed(() => enc.statesBlock(props.combatant))
const statesValue = computed(() => enc.statesValue(props.combatant))

function onStatesUpdate(_id, ids) {
  enc.setStates(props.combatant, ids)
}

const localCharCtx = reactive({ ownerMode: false, dictionaries: {}, var: {} })
provide('charCtx', localCharCtx)

const suggestStoreLocal = useSuggestStore()
const statesAllItems = computed(() => {
  const sid = statesBlock.value?.content?.suggest_id
  if (sid == null) return []
  return suggestStoreLocal.items(sid) || []
})

const canEdit = computed(() => !!enc.canEditPlayerHp())
const rowMenuVisible = computed(() => canEdit.value)

const statesEditorOpen = ref(false)

function openStatesEditor() {
  statesEditorOpen.value = true
}

function onStatesToggle(id) {
  const cur = statesValue.value
  const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
  enc.setStates(props.combatant, next)
}

function onStatesCreated(item) {
  const sid = statesBlock.value?.content?.suggest_id
  if (sid != null) suggestStoreLocal.addItem(sid, item)
  enc.setStates(props.combatant, [...statesValue.value, item.id])
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
.enc-row-shell {
  display: flex;
  min-width: 0;
  align-items: stretch;
  gap: 10px;
}

.enc-row-shell--placeholder :deep(.enc-row-order) { opacity: 0.25; }

.enc-row {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  transition: background 0.12s, opacity 0.12s;
  position: relative;
  cursor: grab;
  touch-action: none;
}

.enc-row:active { cursor: grabbing; }
.enc-row:hover { background: color-mix(in srgb, var(--tile-color) 6%, var(--surface)); }

.enc-row.enc-row--current {
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
}

.enc-row.enc-row--placeholder {
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
  border: 2px dashed color-mix(in srgb, var(--accent) 50%, transparent);
  border-radius: 12px;
}
.enc-row--placeholder > * { visibility: hidden; }
.enc-row.enc-row--placeholder:hover { background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }

.enc-row--skipped { opacity: 0.5; }
.enc-row--skipped.enc-row--current { opacity: 1; }

.enc-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.enc-info-hp { margin-top: 1px; }

.enc-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.enc-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.enc-name--clickable { cursor: pointer; transition: color 0.12s; }
.enc-name--clickable:hover { color: var(--accent); }

.enc-sub {
  font-size: 11px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.enc-states {
  display: inline-flex;
  align-items: center;
  margin-left: 2px;
}

.enc-note {
  font-size: 11px;
  color: var(--text-2);
  font-style: italic;
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 1px 7px;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enc-badge {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.07em;
  border-radius: 4px;
  padding: 2px 5px;
  border: 1px solid;
}

.enc-badge--clickable { cursor: pointer; }
.enc-badge--clickable:hover { opacity: 0.75; }

.badge--enemy   { color: var(--side-enemy); background: color-mix(in srgb, var(--side-enemy) 12%, transparent); border-color: color-mix(in srgb, var(--side-enemy) 25%, transparent); }
.badge--ally    { color: var(--success); background: color-mix(in srgb, var(--success) 12%, transparent); border-color: color-mix(in srgb, var(--success) 25%, transparent); }
.badge--neutral { color: var(--side-neutral); background: color-mix(in srgb, var(--side-neutral) 12%, transparent); border-color: color-mix(in srgb, var(--side-neutral) 25%, transparent); }
.badge--minion  { color: var(--side-minion); background: color-mix(in srgb, var(--side-minion) 12%, transparent); border-color: color-mix(in srgb, var(--side-minion) 28%, transparent); }

.enc-popover-item {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 6px 10px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  color: var(--text-2);
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.enc-popover-item:hover { background: color-mix(in srgb, var(--text-on-accent) 5%, transparent); color: var(--text-1); }
.enc-popover-item--active { background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--text-1); border-color: color-mix(in srgb, var(--accent) 40%, transparent); }

.enc-popover-item--enemy   { color: var(--side-enemy); }
.enc-popover-item--ally    { color: var(--success); }
.enc-popover-item--neutral { color: var(--side-neutral); }
.enc-popover-item--minion  { color: var(--side-minion); }
.enc-popover-item--danger  { color: var(--danger); }
.enc-popover-item--danger:hover { background: color-mix(in srgb, var(--danger) 12%, transparent); }

.enc-surprised-toggle {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  border: 1px solid var(--surface-raised);
  border-radius: 4px;
  padding: 2px 5px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}

.enc-surprised-toggle.active {
  color: var(--warning);
  border-color: color-mix(in srgb, var(--warning) 40%, transparent);
  background: color-mix(in srgb, var(--warning) 12%, transparent);
}

.enc-surprised-chip {
  font-size: 9px;
  font-weight: 700;
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning) 35%, transparent);
  border-radius: 4px;
  padding: 2px 5px;
}

.enc-hp-dice-btn {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  padding: 0;
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 8%, transparent);
  border-radius: 7px;
  color: var(--text-2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.12s, border-color 0.12s, transform 0.08s;
}
.enc-hp-dice-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}
.enc-hp-dice-btn:active { transform: scale(0.94); }

</style>
