<template>
  <div class="p-card" :class="{ 'p-card--selected': selectionMode && selected }" @click="$emit('select', participant.charId)">
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

    <div v-if="selectionMode" class="p-check">
      <svg v-if="selected" width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import StatBar from '@/shared/ui/StatBar.vue'
import { pvAvatar, pvHp, pvName, pvSubtitle } from '@/features/sessions/lib/participantView'

const AVATAR_COLORS = ['#7c5ce2', '#c85ce8', '#5cb0e8', '#e85c8a', '#5ce884', '#e89c3c', '#ff6b6b']

const props = defineProps({
  participant: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  selectionMode: { type: Boolean, default: false },
})
defineEmits(['select'])

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
  if (hpPercent.value > 50) return '#5ce87c'
  if (hpPercent.value > 25) return '#e89c3c'
  return '#e85c5c'
})

const avatarColor = computed(() => {
  const code = initial.value.charCodeAt(0)
  return AVATAR_COLORS[code % AVATAR_COLORS.length]
})
</script>

<style scoped>
.p-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: none;
  cursor: pointer;
  transition: background 0.15s;
  user-select: none;
}

.p-card:hover {
  background: color-mix(in srgb, #fff 4%, transparent);
}

.p-card--selected {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.p-card--selected:hover {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
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
  color: #fff;
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

.p-check {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: 1.5px solid #303045;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
  color: var(--accent);
  margin-top: 1px;
}

.p-card--selected .p-check {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 20%, transparent);
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
  color: #5cb0e8;
  font-size: 10px;
}

.hp-sep {
  color: #404055;
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
  color: #e85c5c;
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
  border: 1px solid #404055;
  background: transparent;
  transition: background 0.15s, border-color 0.15s;
}

.ds-pip.ds-success.filled {
  background: #5ce87c;
  border-color: #5ce87c;
}

.ds-pip.ds-failure.filled {
  background: #e85c5c;
  border-color: #e85c5c;
}

.ds-sep {
  font-size: 10px;
  color: #404055;
}
</style>
