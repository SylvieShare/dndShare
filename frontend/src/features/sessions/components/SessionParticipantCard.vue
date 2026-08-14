<template>
  <div class="p-card-menu">
    <RowActionMenu>
      <template #trigger>
        <BaseTile
          class="p-card"
          :class="{
            'p-card--marked': participant.color,
            'p-card--combat': combatMode,
            'p-card--current': combatMode && combatCurrent,
          }"
          interactive
          :mark-color="participant.color"
        >
          <EncounterCombatControls
            v-if="combatMode"
            :combatant="combatant"
            :selected="combatSelected"
            :editable="combatEditable"
            :armor-class="armorClass"
            :current="combatCurrent"
            @update:selected="$emit('update:combat-selected', $event)"
            @update:initiative="$emit('update:initiative', $event)"
          />

          <div class="p-avatar" :style="{ background: avatarColor }">
            <img v-if="avaUrl" :src="avaUrl" class="ava-img" alt="" />
            <span v-else class="ava-initial">{{ initial }}</span>
          </div>

          <div class="p-info">
            <div class="p-name">{{ displayName }}</div>
            <div v-if="who" class="p-who">{{ who }}</div>

            <template v-if="showHp">
              <template v-if="isDead">
                <div class="ds-row">
                  <span class="ds-label">Смерть</span>
                  <span class="ds-group">
                    <span
                      v-for="i in 3"
                      :key="'s' + i"
                      class="ds-pip ds-success"
                      :class="{ filled: i <= hp.ds_success }"
                    />
                  </span>
                  <span class="ds-sep">/</span>
                  <span class="ds-group">
                    <span
                      v-for="i in 3"
                      :key="'f' + i"
                      class="ds-pip ds-failure"
                      :class="{ filled: i <= hp.ds_failure }"
                    />
                  </span>
                </div>
              </template>

              <template v-else>
                <div class="hp-row">
                  <StatBar
                    class="p-hp-statbar"
                    size="small"
                    :percent="hpPercent"
                    :color="hpColor"
                    :temp-percent="tempPercent"
                  />
                  <div class="hp-numbers">
                    <span class="hp-current" :style="{ color: hpColor }">{{ hp.current }}</span>
                    <span v-if="hp.temp" class="hp-temp">+{{ hp.temp }}</span>
                    <span class="hp-sep">/</span>
                    <span class="hp-max">{{ hp.max }}</span>
                  </div>
                </div>
              </template>
            </template>
          </div>

        </BaseTile>
      </template>

      <template #default="{ close }">
        <RowActionItem action="view" @click="viewParticipant(close)">Просмотреть</RowActionItem>
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
import { computed } from 'vue'
import { Palette } from '@lucide/vue'
import BaseTile from '@/shared/ui/BaseTile.vue'
import ColorPresetPicker from '@/shared/ui/ColorPresetPicker.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import RowActionMenu from '@/shared/ui/RowActionMenu.vue'
import RowActionSubmenu from '@/shared/ui/RowActionSubmenu.vue'
import EncounterCombatControls from '@/features/sessions/components/EncounterCombatControls.vue'
import StatBar from '@/shared/ui/StatBar.vue'
import { pvAc, pvAvatar, pvHp, pvName, pvSubtitle } from '@/features/sessions/lib/participantView'

const AVATAR_COLORS = ['var(--accent)', 'var(--accent)', 'var(--info)', 'var(--danger)', 'var(--success)', 'var(--warning)', 'var(--danger)']

const props = defineProps({
  participant: { type: Object, required: true },
  isDm: { type: Boolean, default: false },
  kickPending: { type: Boolean, default: false },
  colorPending: { type: Boolean, default: false },
  combatMode: { type: Boolean, default: false },
  combatant: { type: Object, default: null },
  combatSelected: { type: Boolean, default: false },
  combatCurrent: { type: Boolean, default: false },
  combatEditable: { type: Boolean, default: false },
})
const emit = defineEmits(['view', 'kick', 'color', 'update:combat-selected', 'update:initiative'])

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

const who = computed(() => pvSubtitle(props.participant))
const armorClass = computed(() => pvAc(props.participant))

const hp = computed(() => {
  const v = pvHp(props.participant)
  if (!v) return null
  return {
    current:    Number(v.current)    ?? 0,
    max:        Number(v.max)        || 0,
    temp:       Number(v.temp)       || 0,
    ds_success: Number(v.ds_success) || 0,
    ds_failure: Number(v.ds_failure) || 0,
  }
})

const showHp = computed(() => hp.value !== null && hp.value.max > 0)
const isDead = computed(() => showHp.value && hp.value.current <= 0)

const hpPercent = computed(() => {
  if (!showHp.value) return 0
  return Math.min(100, Math.max(0, (hp.value.current / hp.value.max) * 100))
})
const tempPercent = computed(() => {
  if (!showHp.value || !hp.value.temp) return 0
  return Math.min(100 - hpPercent.value, (hp.value.temp / hp.value.max) * 100)
})
const hpColor = computed(() => {
  if (hpPercent.value > 50) return 'var(--success)'
  if (hpPercent.value > 25) return 'var(--warning)'
  return 'var(--danger)'
})

const avatarColor = computed(() => {
  const code = initial.value.charCodeAt(0)
  return AVATAR_COLORS[code % AVATAR_COLORS.length]
})
</script>

<style scoped>
.p-card {
  width: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  user-select: none;
  transition: padding 0.28s cubic-bezier(0.22, 1, 0.36, 1), background 0.18s, border-color 0.18s;
}

.p-card--marked {
  padding-right: 38px;
}

.p-card--combat {
  align-items: center;
  gap: 9px;
  padding-top: 12px;
  padding-bottom: 12px;
}

.p-card--current {
  background: color-mix(in srgb, var(--accent) 11%, var(--surface));
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 10%, transparent);
}

.p-card-menu {
  width: 100%;
}

.p-card-menu :deep(.ram-custom-trigger) {
  display: flex;
  width: 100%;
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
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.p-card--combat .p-avatar {
  width: 48px;
  height: 48px;
}

.ava-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
}

.ava-initial {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-on-accent);
}

.p-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .p-card { transition: none; }
}

.p-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.p-who {
  font-size: 11px;
  color: var(--text-2);
}

.hp-row {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 5px;
}

.p-hp-statbar { flex: 1; }

.hp-numbers {
  display: flex;
  align-items: baseline;
  gap: 2px;
  font-size: 10px;
  flex-shrink: 0;
}

.hp-current {
  font-weight: 700;
  font-size: 11px;
}

.hp-temp {
  color: var(--info);
  font-size: 10px;
}

.hp-sep {
  color: var(--text-muted);
  margin: 0 1px;
}

.hp-max {
  color: var(--text-muted);
}

.ds-row {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 5px;
}

.ds-label {
  font-size: 10px;
  color: var(--danger);
  font-weight: 600;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.ds-group {
  display: flex;
  gap: 3px;
}

.ds-pip {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid var(--surface-active);
  background: transparent;
  transition: background 0.15s, border-color 0.15s;
}

.ds-pip.ds-success.filled {
  background: var(--success);
  border-color: var(--success);
}

.ds-pip.ds-failure.filled {
  background: var(--danger);
  border-color: var(--danger);
}

.ds-sep {
  font-size: 10px;
  color: var(--text-muted);
}
</style>
