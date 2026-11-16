<template>
  <div
    class="p-card-menu"
    :class="{ 'p-card-menu--placeholder': reorderPlaceholder }"
    :role="selectionMode ? 'checkbox' : undefined" :aria-checked="selectionMode ? combatSelected : undefined"
    :aria-label="selectionMode ? `Выбрать: ${displayName}` : undefined" :tabindex="selectionMode ? 0 : undefined"
    @keydown.enter.self.prevent="selectByKeyboard" @keydown.space.self.prevent="selectByKeyboard"
    @pointerdown="startReorder"
    @click.capture="suppressReorderClick"
    @contextmenu.capture="suppressReorderClick"
  >
    <WorkspaceRowDivider v-if="divided" class="roster-divider" />
    <RowActionMenu :trigger-attrs="{ inert: selectionMode || undefined }">
      <template #trigger>
        <SessionPlayerTile
          class="p-card"
          :class="{ 'p-card--combat': combatMode, 'p-card--statuses': hasStatuses, 'p-card--compact': compact, 'p-card--current': combatMode && combatCurrent, 'p-card--reorderable': reorderEnabled }"
          :participant="participant" :name="displayName" :avatar-url="avaUrl" :hp="hp" :health-visible="showHp" :show-stats="isDm && isDnd"
          :color="participant.color" :compact="compact" :current="combatMode && combatCurrent"
          :has-statuses="hasStatuses" :selection-mode="selectionMode" :selected="combatSelected"
        >
          <template #name-suffix>
            <span v-if="combatant?.position === 'reserve' && combatant.initiative != null" class="p-initiative-chip" title="Подготовленная инициатива" :aria-label="`Подготовленная инициатива: ${combatant.initiative}`"><img src="/static/initiative.svg" width="14" height="14" alt="" />{{ combatant.initiative }}</span>
          </template>
          <template v-if="showHp && isDead" #health><SessionPlayerDeathState :hp="hp" :editable="isDm" @revive="$emit('revive')" /></template>
          <template #statuses><ParticipantStatuses :participant="participant" :editable="isDm" detailed /></template>
        </SessionPlayerTile>
      </template>

      <template #default="{ close }">
        <EncounterInitiativeMenu v-if="isDm && combatant?.position === 'reserve' && encounter?.encounter.active" enter-combat :combatant="combatant" :encounter="encounter" @joined="close" />
        <EncounterInitiativeMenu v-if="isDm && combatMode && combatant && encounter && !encounter.encounter.active && combatant.position !== 'dead'" :combatant="combatant" :encounter="encounter" />
        <RowActionItem v-if="isDm || participant.canOpenSheet" action="view" @click="viewParticipant(close)">Открыть лист</RowActionItem>
        <RowActionItem v-if="canCalculateHp" :icon="Calculator" @click="encounter.openHpCalc(combatant); close()">Калькулятор ХП</RowActionItem>
        <RowActionSubmenu v-if="isDm" label="Цвет игрока" :disabled="colorPending">
          <template #trigger="{ open }">
            <RowActionItem
              :icon="Palette"
              :disabled="colorPending"
              submenu
              :submenu-open="open"
            >
              {{ colorPending ? 'Сохранение…' : 'Назначить цвет' }}
              <template #suffix>
                <span
                  class="participant-color-swatch"
                  :class="{ 'participant-color-swatch--empty': !participant.color }"
                  :style="participant.color ? { background: participant.color } : null"
                />
              </template>
            </RowActionItem>
          </template>
          <template #default="{ close: closeColor }">
            <ColorPresetPicker
              inline
              allow-clear
              :model-value="participant.color || ''"
              @update:model-value="color => assignColor(color, closeColor)"
            />
          </template>
        </RowActionSubmenu>
        <RowActionItem
          v-if="isDm"
          action="kick"
          tone="danger"
          :disabled="kickPending"
          @click="kickParticipant(close)"
        >{{ kickPending ? 'Исключение…' : 'Выгнать' }}</RowActionItem>
      </template>
    </RowActionMenu>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, inject } from 'vue'
import { useTemplateStore } from '@/stores/template'
import { settingAccessors } from '@/features/character-editor/settings'
import { handleCtrlSelection } from '@/shared/lib/ctrlSelection'
import { hasDndStatusSummary } from '@/features/character-editor/lib/dndStatusSummary'
import { hpMaximum } from '@/features/character-editor/blocks/dnd/lib/hp'
import { Calculator, Palette } from '@lucide/vue'
import { ColorPresetPicker } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { RowActionMenu } from '@sylvieshare/share-ui'
import { RowActionSubmenu } from '@sylvieshare/share-ui'
import EncounterInitiativeMenu from './EncounterInitiativeMenu.vue'
import SessionPlayerTile from './SessionPlayerTile.vue'
import SessionPlayerDeathState from './SessionPlayerDeathState.vue'
import WorkspaceRowDivider from '@/shared/ui/WorkspaceRowDivider.vue'
import { pvAvatar, pvHp, pvHpPath, pvName } from '@/features/sessions/lib/participantView'

const ParticipantStatuses = defineAsyncComponent(() => import('./ParticipantStatuses.vue'))
const encounter = inject('applicationEncounter', null)
const templates = useTemplateStore()
const isDnd = computed(() => settingAccessors(templates.byId(props.participant.templateId))?.system === 'dnd5e')


const props = defineProps({
  participant: { type: Object, required: true },
  isDm: { type: Boolean, default: false },
  kickPending: { type: Boolean, default: false },
  colorPending: { type: Boolean, default: false },
  reorderEnabled: { type: Boolean, default: false },
  reorderPlaceholder: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
  shouldSuppressReorderClick: { type: Function, default: null },
  combatMode: { type: Boolean, default: false },
  combatant: { type: Object, default: null },
  combatSelected: { type: Boolean, default: false },
  combatCurrent: { type: Boolean, default: false },
  combatEditable: { type: Boolean, default: false },
  selectionMode: Boolean,
  divided: Boolean,
})
const emit = defineEmits(['view', 'kick', 'color', 'revive', 'drag-start', 'update:combat-selected', 'start-selection'])

const hasStatuses = computed(() => props.isDm && isDnd.value && hasDndStatusSummary(props.participant.data?.values || {}))

const REORDER_IGNORE = 'button, input, textarea, select, a, [contenteditable="true"], .p-combat-controls'

function startReorder(event) {
  if (!props.reorderEnabled || props.selectionMode || event.ctrlKey || event.metaKey) return
  if (event.button !== undefined && event.button !== 0) return
  if (event.target.closest(REORDER_IGNORE)) return
  emit('drag-start', event)
}

function suppressReorderClick(event) {
  if (props.selectionMode && props.combatEditable && props.combatant) {
    event.preventDefault();event.stopPropagation()
    emit('update:combat-selected', !props.combatSelected)
    return
  }
  if (event.target.closest('.p-statuses-area')) return
  if (handleCtrlSelection(event, props.combatEditable && !!props.combatant, () => {emit('start-selection');emit('update:combat-selected', !props.combatSelected)})) return
  if (!props.shouldSuppressReorderClick?.()) return
  event.preventDefault()
  event.stopPropagation()
}

function selectByKeyboard() {
  if (props.selectionMode && props.combatEditable && props.combatant) emit('update:combat-selected', !props.combatSelected)
}

function viewParticipant(close) {
  close()
  emit('view', props.participant.charId)
}

function kickParticipant(close) {
  if (props.kickPending) return
  close()
  emit('kick', props.participant.charId)
}

function assignColor(color, close) {
  if (props.colorPending) return
  emit('color', props.participant.charId, color)
  close()
}

const displayName = computed(() => pvName(props.participant) || '(без имени)')

const avaUrl = computed(() => pvAvatar(props.participant))


const hp = computed(() => {
  const v = pvHp(props.participant)
  if (!v) return null
  return {
    current:    Number(v.current)    || 0,
    max:        hpMaximum(v),
    temp:       Number(v.temp)       || 0,
    ds_success: Number(v.ds_success) || 0,
    ds_failure: Number(v.ds_failure) || 0,
  }
})

const showHp = computed(() => hp.value !== null && hp.value.max > 0)
const canCalculateHp = computed(() => props.isDm && !!encounter && !!props.combatant && !!hp.value && !!pvHpPath(props.participant))
const isDead = computed(() => showHp.value && hp.value.current <= 0)

</script>

<style scoped>
.p-card.p-card--reorderable { cursor: grab; touch-action: none; }
.p-card.p-card--reorderable:active { cursor: grabbing; }

.p-card-menu {
  width: 100%;
  position:relative;
  border-radius:0;
}
.roster-divider {z-index:2}
.p-card-menu[role="checkbox"]:focus-visible {outline:2px solid var(--accent-soft);outline-offset:2px}

.p-card-menu :deep(.ram-custom-trigger) {
  display: flex;
  width: 100%;
}

.p-card-menu--placeholder :deep(.ram-custom-trigger) {
  visibility: hidden;
}

.participant-color-swatch {
  display: block;
  width: 16px;
  height: 16px;
  border: 1px solid var(--border-strong);
  border-radius: 5px;
}

.participant-color-swatch--empty {
  background: var(--bg);
  border-style: dashed;
}

.p-initiative-chip { display: inline-flex; flex: none; align-items: center; gap: 4px; padding: 2px 5px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface-raised); color: var(--text-1); font-size: 12px; font-weight: 750; }

</style>
