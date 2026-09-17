<template>
  <div
    class="p-card-menu"
    :class="{ 'p-card-menu--placeholder': reorderPlaceholder }"
    @pointerdown="startReorder"
    @click.capture="suppressReorderClick"
    @contextmenu.capture="suppressReorderClick"
  >
    <RowActionMenu>
      <template #trigger>
        <BaseTile
          class="p-card"
          :class="{
            'p-card--combat': combatMode,
            'p-card--compact': compact,
            'p-card--current': combatMode && combatCurrent,
            'p-card--reorderable': reorderEnabled,
          }"
          :title="compact ? displayName : undefined"
          :style="participantTileStyle"
          interactive
        >
          <div class="p-combat-controls" :aria-hidden="!combatMode" :inert="!combatMode" @click.stop @pointerdown.stop>
            <CompactCheckbox :size="20" :model-value="combatSelected" :label="`Выбрать: ${displayName}`" :disabled="!combatEditable || !combatant" @update:model-value="$emit('update:combat-selected', $event)" />
          </div>

          <div class="p-avatar" :class="{ 'p-avatar--icon': isIcon }" :style="participantAvatarStyle">
            <img v-if="avaUrl" :src="avaUrl" class="ava-img" alt="" />
            <span v-else class="ava-initial">{{ initial }}</span>
          </div>

          <div class="p-info">
            <div class="p-name-row"><div class="p-name">{{ displayName }}</div><span v-if="combatant?.position === 'reserve' && combatant.initiative != null" class="p-initiative-chip" title="Подготовленная инициатива" :aria-label="`Подготовленная инициатива: ${combatant.initiative}`"><img src="/static/initiative.svg" width="14" height="14" alt="" />{{ combatant.initiative }}</span></div>

            <template v-if="showHp">
              <template v-if="isDead">
                <div class="ds-row">
                  <span class="ds-label">При смерти</span>
                  <span class="ds-counts">(✓ {{ hp.ds_success }} / ✕ {{ hp.ds_failure }})</span>
                  <button
                    v-if="isDm"
                    type="button"
                    class="ds-revive"
                    title="Воскресить игрока"
                    aria-label="Воскресить игрока"
                    @click.stop="$emit('revive')"
                  ><HeartPulse :size="14" /></button>
                </div>
              </template>

              <template v-else>
                <SessionHpBar :hp="hp" />
              </template>
            </template>
          </div>

        </BaseTile>
      </template>

      <template #default="{ close }">
        <ParticipantMenuStats v-if="isDm && isDnd" :participant="participant" />
        <EncounterInitiativeMenu v-if="isDm && combatant?.position === 'reserve' && encounter?.encounter.active" enter-combat :combatant="combatant" :encounter="encounter" @joined="close" />
        <EncounterInitiativeMenu v-if="isDm && combatMode && combatant && encounter && !encounter.encounter.active && combatant.position !== 'dead'" :combatant="combatant" :encounter="encounter" />
        <RowActionItem v-if="isDm || participant.canOpenSheet" action="view" @click="viewParticipant(close)">Открыть лист</RowActionItem>
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
import { hpMaximum } from '@/features/character-editor/blocks/dnd/lib/hp'
import { HeartPulse, Palette } from '@lucide/vue'
import { BaseTile, CompactCheckbox } from '@sylvieshare/share-ui'
import { ColorPresetPicker } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { RowActionMenu } from '@sylvieshare/share-ui'
import { RowActionSubmenu } from '@sylvieshare/share-ui'
import EncounterInitiativeMenu from './EncounterInitiativeMenu.vue'
import SessionHpBar from './SessionHpBar.vue'
import { pvAvatar, pvHp, pvName } from '@/features/sessions/lib/participantView'

const ParticipantMenuStats = defineAsyncComponent(() => import('./ParticipantMenuStats.vue'))
const encounter = inject('applicationEncounter', null)
const templates = useTemplateStore()
const isDnd = computed(() => settingAccessors(templates.byId(props.participant.templateId))?.system === 'dnd5e')

const AVATAR_COLORS = ['var(--accent)', 'var(--accent)', 'var(--info)', 'var(--danger)', 'var(--success)', 'var(--warning)', 'var(--danger)']

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
})
const emit = defineEmits(['view', 'kick', 'color', 'revive', 'drag-start', 'update:combat-selected'])

const REORDER_IGNORE = 'button, input, textarea, select, a, [contenteditable="true"], .p-combat-controls'

function startReorder(event) {
  if (!props.reorderEnabled || event.ctrlKey || event.metaKey) return
  if (event.button !== undefined && event.button !== 0) return
  if (event.target.closest(REORDER_IGNORE)) return
  emit('drag-start', event)
}

function suppressReorderClick(event) {
  if (handleCtrlSelection(event, props.combatMode && props.combatEditable && !!props.combatant, () => emit('update:combat-selected', !props.combatSelected))) return
  if (!props.shouldSuppressReorderClick?.()) return
  event.preventDefault()
  event.stopPropagation()
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
const initial = computed(() => displayName.value.charAt(0).toUpperCase())

const avaUrl = computed(() => pvAvatar(props.participant))
const isIcon = computed(() => Boolean(props.participant.iconImageUrl))


const hp = computed(() => {
  const v = pvHp(props.participant)
  if (!v) return null
  return {
    current:    Number(v.current)    ?? 0,
    max:        hpMaximum(v),
    temp:       Number(v.temp)       || 0,
    ds_success: Number(v.ds_success) || 0,
    ds_failure: Number(v.ds_failure) || 0,
  }
})

const showHp = computed(() => hp.value !== null && hp.value.max > 0)
const isDead = computed(() => showHp.value && hp.value.current <= 0)

const avatarColor = computed(() => {
  const code = initial.value.charCodeAt(0)
  return AVATAR_COLORS[code % AVATAR_COLORS.length]
})

const participantAvatarStyle = computed(() => ({
  background: avaUrl.value ? 'transparent' : avatarColor.value,
}))
const participantTileStyle = computed(() => ({
  '--participant-color': props.participant.color || 'var(--border)',
  '--participant-frame-width': props.participant.color ? '2px' : '1px',
}))
</script>

<style scoped>
.p-card {
  width: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: var(--participant-card-gap, 9px);
  height: 72px;
  padding: 4px 14px 4px 4px;
  overflow: hidden;
  user-select: none;
  transition: height 0.42s cubic-bezier(0.22, 1, 0.36, 1), gap 0.42s cubic-bezier(0.22, 1, 0.36, 1), padding 0.42s cubic-bezier(0.22, 1, 0.36, 1), background 0.18s, border-color 0.18s, box-shadow 0.18s;
}

.p-card.base-tile {
  box-shadow: inset 0 0 0 var(--participant-frame-width) var(--participant-color);
}

.p-card--compact { height: 48px; gap: 0; padding: 6px; justify-content: center; }
.p-card--compact .p-combat-controls { margin-left: calc(-1 * var(--participant-selection-width, 36px)); }

.p-card.p-card--reorderable { cursor: grab; touch-action: none; }
.p-card.p-card--reorderable:active { cursor: grabbing; }

.p-card.base-tile--interactive:hover {
  box-shadow: inset 0 0 0 var(--participant-frame-width) var(--participant-color);
}

.p-combat-controls {
  width: var(--participant-selection-width, 36px);
  flex: 0 0 var(--participant-selection-width, 36px);
  box-sizing: border-box;
  padding: 0 2px 0 10px;
  display: flex;
  justify-content: center;
  margin-left: calc(-1 * (var(--participant-selection-width, 36px) + var(--participant-card-gap, 9px)));
  clip-path: inset(0 0 0 100%);
  pointer-events: none;
  animation: none;
  transition:
    margin-left 0.42s cubic-bezier(0.22, 1, 0.36, 1),
    clip-path 0.42s cubic-bezier(0.22, 1, 0.36, 1);
}

.p-card--combat .p-combat-controls {
  margin-left: 0;
  clip-path: inset(-12px);
  pointer-events: auto;
}

.p-card.p-card--current,
.p-card.p-card--current.base-tile--interactive:hover {
  background: color-mix(in srgb, var(--accent) 11%, var(--surface));
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border));
  box-shadow:
    inset 0 0 0 var(--participant-frame-width) var(--participant-color),
    0 0 0 2px color-mix(in srgb, var(--accent) 10%, transparent);
}

.p-card-menu {
  width: 100%;
}

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

.p-avatar {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.p-avatar--icon {
  border-radius: 0;
}

.ava-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  -webkit-mask-image: radial-gradient(ellipse 82% 84% at 50% 44%, var(--text-on-accent) 54%, transparent 100%);
  mask-image: radial-gradient(ellipse 82% 84% at 50% 44%, var(--text-on-accent) 54%, transparent 100%);
}

.p-avatar--icon .ava-img {
  object-fit: contain;
  object-position: center;
  -webkit-mask-image: none;
  mask-image: none;
}

.ava-initial {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-on-accent);
}

.p-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  opacity: 1;
  transform: translateX(0);
  transition: opacity 0.2s ease, transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
}

.p-card--compact .p-info { flex: 0 0 0; overflow: hidden; opacity: 0; transform: translateX(-7px); }
.p-card--compact .p-avatar { width: 36px; height: 36px; }
.p-card--compact .ava-initial { font-size: 14px; }

@media (prefers-reduced-motion: reduce) {
  .p-card,
  .p-combat-controls,
  .p-info { transition: none; }
}

.p-name-row { display: flex; align-items: center; gap: 6px; }
.p-initiative-chip { display: inline-flex; flex: none; align-items: center; gap: 4px; padding: 2px 5px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface-raised); color: var(--text-1); font-size: 12px; font-weight: 750; }
.p-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ds-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 5px;
}

.ds-label {
  font-size: 10px;
  color: var(--danger);
  font-weight: 600;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.ds-counts { overflow: hidden; color: var(--text-muted); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }

.ds-revive {
  width: 24px;
  height: 24px;
  display: grid;
  flex: 0 0 24px;
  place-items: center;
  margin-left: auto;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--success) 42%, var(--border));
  border-radius: 7px;
  background: color-mix(in srgb, var(--success) 11%, transparent);
  color: var(--success);
  cursor: pointer;
}

.ds-revive:hover { border-color: var(--success); background: color-mix(in srgb, var(--success) 18%, transparent); }
</style>
