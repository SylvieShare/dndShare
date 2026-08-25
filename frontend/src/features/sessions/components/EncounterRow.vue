<template>
  <div
    class="enc-row-shell"
    :class="{ 'enc-row-shell--placeholder': enc.sortable.isSource(combatant) }"
    :data-sortable-key="combatant.uid"
    :data-encounter-uid="combatant.uid"
    :data-encounter-section="section"
  >
    <EncounterOrderMarker
      v-if="order != null"
      :order="order"
      :current="isCurrent"
    />

    <BaseTile
      class="enc-row"
      :class="rowClasses"
      :color="rowAccentColor || 'var(--section-color)'"
      :strip="isNpc && !!rowAccentColor"
      :style="playerColor ? { '--enc-player-color': playerColor } : null"
      @pointerdown="onRowPointerDown"
      @click="onRowClick"
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
        <div v-if="statesBlock && stateItems.length" class="enc-states">
          <button
            v-for="item in stateItems"
            :key="item.id"
            type="button"
            class="enc-state"
            :title="`Убрать ${item.name}`"
            @click.stop="removeState(item.id)"
          >{{ item.name }} ×</button>
        </div>
        <span v-if="isNpc && combatant.note" class="enc-note" :title="combatant.note">{{ combatant.note }}</span>
      </div>
      <EncounterHpBar class="enc-info-hp" :combatant="combatant" :section="section" />
      <div v-if="subtitleText" class="enc-sub">{{ subtitleText }}</div>
    </div>

    <EncounterChallengeResult
      v-if="challengeResult"
      class="enc-row-challenge"
      :challenge="enc.challenge"
      :ability="challengeAbility"
      :result="challengeResult"
      @reroll="enc.rerollChallenge(combatant, $event)"
    />

    <EncounterRowMenu
      v-if="rowMenuVisible"
      ref="rowMenuRef"
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
import { computed, inject, provide, reactive, ref } from 'vue'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import EncounterAvatar from '@/features/sessions/components/EncounterAvatar.vue'
import EncounterCombatControls from '@/features/sessions/components/EncounterCombatControls.vue'
import EncounterChallengeResult from '@/features/sessions/components/EncounterChallengeResult.vue'
import EncounterHpBar from '@/features/sessions/components/EncounterHpBar.vue'
import EncounterMarkerMenu from '@/features/sessions/components/EncounterMarkerMenu.vue'
import EncounterOrderMarker from '@/features/sessions/components/EncounterOrderMarker.vue'
import EncounterRowMenu from '@/features/sessions/components/EncounterRowMenu.vue'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { BasePopover } from '@sylvieshare/share-ui'
import { BaseTile } from '@sylvieshare/share-ui'
import { FormActionButtons } from '@sylvieshare/share-ui'
import { FormTextarea } from '@sylvieshare/share-ui'
import { useItemReferenceMap } from '@/features/sessions/composables/useItemReferenceMap'

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
const rowAccentColor = computed(() => enc.tileColor(props.combatant))

const displayName = computed(() =>
  isPlayer.value ? enc.playerDisplayName(props.combatant) : enc.npcName(props.combatant)
)

const hasItem = computed(() => isNpc.value && props.combatant.itemId != null)

const subtitleText = computed(() => enc.subtitle(props.combatant))
const challengeResult = computed(() =>
  props.section === 'combat' ? enc.challengeResult(props.combatant) : null
)
const challengeAbility = computed(() => enc.challengeAbilityMeta(enc.challenge?.ability))

const skippedInTurn = computed(() =>
  props.section === 'combat' && enc.encounter.active && !enc.isActiveInTurn(props.combatant)
)

const rowClasses = computed(() => ({
  'enc-row--current': props.isCurrent,
  'enc-row--player-colored': isPlayer.value && !!playerColor.value,
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

const localCharCtx = reactive({ ownerMode: false, dictionaries: {}, var: {} })
provide('charCtx', localCharCtx)

const { itemById: stateItemById } = useItemReferenceMap(statesValue)
const stateItems = computed(() => statesValue.value.map(stateItemById).filter(Boolean))

const canEdit = computed(() => !!enc.canEditPlayerHp())
const rowMenuVisible = computed(() => canEdit.value)
const rowMenuRef = ref(null)

function onRowClick(event) {
  if (!rowMenuVisible.value || enc.sortable.shouldSuppressClick()) return
  if (event.target?.closest?.(DRAG_IGNORE)) return
  rowMenuRef.value?.toggle(event)
}

const statesEditorOpen = ref(false)

function openStatesEditor() {
  statesEditorOpen.value = true
}

function addState(item) {
  enc.setStates(props.combatant, [...statesValue.value, item.id])
  statesEditorOpen.value = false
}

function removeState(itemId) {
  enc.setStates(props.combatant, statesValue.value.filter(id => String(id) !== String(itemId)))
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

.enc-row-shell[data-encounter-section="combat"] {
  width: 100%;
  max-width: 880px;
}

.enc-row-shell--placeholder :deep(.enc-row-order) { opacity: 0.25; }

.enc-row {
  display: flex;
  flex: 1;
  height: 92px;
  min-width: 0;
  box-sizing: border-box;
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

.enc-row.enc-row--player-colored {
  box-shadow: inset 0 0 0 2px var(--enc-player-color);
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
  max-height: 72px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  justify-content: center;
  overflow: hidden;
}

.enc-info-hp {
  max-width: 300px;
  margin-top: 1px;
}

.enc-row-challenge {
  width: 248px;
  height: 72px;
  min-height: 72px;
  flex: 0 0 248px;
  align-self: center;
}

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
  gap: 3px;
  margin-left: 2px;
}
.enc-state {
  max-width: 110px;
  overflow: hidden;
  padding: 1px 6px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  font-family: inherit;
  font-size: 9px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.enc-state:hover { border-color: var(--danger); color: var(--danger); }

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

</style>
