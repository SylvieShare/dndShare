<template>
  <div class="p-card-menu">
    <RowActionMenu>
      <template #trigger>
        <BaseTile class="p-card" interactive>
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
import BaseTile from '@/shared/ui/BaseTile.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import RowActionMenu from '@/shared/ui/RowActionMenu.vue'
import StatBar from '@/shared/ui/StatBar.vue'
import { pvAvatar, pvHp, pvName, pvSubtitle } from '@/features/sessions/lib/participantView'

const AVATAR_COLORS = ['var(--accent)', 'var(--accent)', 'var(--info)', 'var(--danger)', 'var(--success)', 'var(--warning)', 'var(--danger)']

const props = defineProps({
  participant: { type: Object, required: true },
  isDm: { type: Boolean, default: false },
  kickPending: { type: Boolean, default: false },
})
const emit = defineEmits(['view', 'kick'])

function viewParticipant(close) {
  close()
  emit('view', props.participant.charId)
}

function kickParticipant(close) {
  if (props.kickPending) return
  close()
  emit('kick', props.participant.charId)
}

const displayName = computed(() => pvName(props.participant) || '(без имени)')
const initial = computed(() => displayName.value.charAt(0).toUpperCase())

const avaUrl = computed(() => pvAvatar(props.participant))

const who = computed(() => pvSubtitle(props.participant))

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
}

.p-card-menu {
  width: 100%;
}

.p-card-menu :deep(.ram-custom-trigger) {
  display: flex;
  width: 100%;
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
