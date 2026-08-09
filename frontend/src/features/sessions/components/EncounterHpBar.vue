<template>
  <div
    class="enc-hp-area"
    :class="{ 'enc-hp-area--clickable': hpClickable, 'enc-hp-area--dead': dsVisible }"
    @click="onHpAreaClick"
  >
    <div class="enc-hp-bar-wrap" :class="{ 'enc-hp-bar-wrap--dead': dsVisible }">
      <StatBar
        class="enc-hp-statbar"
        size="medium"
        decorated
        :percent="enc.hpPercent(combatant)"
        :color="enc.hpColor(combatant)"
        :temp-percent="hpTempPct"
      />
      <span class="enc-hp-nums">
        <span :style="{ color: enc.hpColor(combatant) }">{{ hpText }}</span>
        <span v-if="hpTempVal > 0" class="enc-hp-temp">+{{ hpTempVal }}</span>
      </span>
    </div>

    <div v-if="dsVisible && isPlayer" class="enc-ds-overlay" @click.stop>
      <div class="enc-ds-side enc-ds-side--fail">
        <span
          v-for="i in [3, 2, 1]"
          :key="'f'+i"
          class="enc-ds-pip enc-ds-pip--fail"
          :class="{ 'enc-ds-pip--filled': i <= dsState.failure }"
          @click="togglePip('failure', i)"
        />
      </div>
      <span class="enc-ds-heart">♥</span>
      <div class="enc-ds-side enc-ds-side--succ">
        <span
          v-for="i in [1, 2, 3]"
          :key="'s'+i"
          class="enc-ds-pip enc-ds-pip--succ"
          :class="{ 'enc-ds-pip--filled': i <= dsState.success }"
          @click="togglePip('success', i)"
        />
      </div>
    </div>

    <div v-else-if="npcDead" class="enc-ds-overlay enc-ds-overlay--npc" @click.stop>
      <span class="enc-skull">💀</span>
      <button
        v-if="canEdit"
        type="button"
        class="enc-graveyard-btn"
        title="Отправить на кладбище"
        @click="enc.sendToGraveyard(combatant)"
      >На кладбище</button>
      <button
        v-if="canEdit"
        type="button"
        class="enc-graveyard-btn enc-revive-btn"
        title="Воскресить с полными хитами"
        @click="enc.reviveCombatant(combatant)"
      >Воскресить</button>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import StatBar from '@/shared/ui/StatBar.vue'

const props = defineProps({
  combatant: { type: Object, required: true },
  section:   { type: String, required: true },
})

const enc = inject('encounter')

const isPlayer = computed(() => props.combatant.type === 'player')
const isNpc    = computed(() => props.combatant.type === 'npc')

const hpTempVal = computed(() => enc.hpTempValue(props.combatant))
const hpTempPct = computed(() => enc.hpTempPercent(props.combatant))

const hpText = computed(() => {
  if (isPlayer.value && props.section !== 'combat') return enc.playerHpLabel(props.combatant) || '—'
  return enc.hpLabel(props.combatant)
})

const hpClickable = computed(() => isNpc.value || (isPlayer.value && enc.canEditPlayerHp()))

function onHpAreaClick() {
  if (!hpClickable.value) return
  if (isNpc.value && props.section === 'reserve-npc') {
    enc.openNpcHpEdit(props.combatant)
  } else {
    enc.openHpCalc(props.combatant)
  }
}

const dsHp = computed(() => {
  if (isNpc.value) return enc.npcDsHp(props.combatant)
  if (isPlayer.value) return enc.playerDsHp(props.combatant)
  return { current: 0, ds_success: 0, ds_failure: 0 }
})

const dsVisible = computed(() => (Number(dsHp.value.current) || 0) <= 0)
const npcDead = computed(() => isNpc.value && dsVisible.value)
const canEdit = computed(() => !!enc.canEditPlayerHp())

const dsState = computed(() => ({
  success: Math.max(0, Math.min(3, Number(dsHp.value.ds_success) || 0)),
  failure: Math.max(0, Math.min(3, Number(dsHp.value.ds_failure) || 0)),
}))

function emitDsChange(nextHp) {
  if (isNpc.value) enc.onNpcDsChange(props.combatant, nextHp)
  else if (isPlayer.value) enc.onPlayerDsChange(props.combatant, nextHp)
}

function togglePip(type, i) {
  const cur = dsState.value[type]
  const next = cur === i ? i - 1 : i
  const base = { ...dsHp.value }
  if (type === 'success' && next === 3) {
    emitDsChange({ ...base, current: 1, ds_success: 0, ds_failure: 0 })
    return
  }
  const key = type === 'success' ? 'ds_success' : 'ds_failure'
  emitDsChange({ ...base, [key]: next })
}
</script>

<style scoped>
.enc-hp-area {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 340px;
  min-width: 0;
  min-height: 22px;
  border-radius: 999px;
}

.enc-hp-area--clickable { cursor: pointer; }
.enc-hp-area--clickable:hover :deep(.stat-bar) { border-color: var(--border-strong); }

.enc-hp-statbar { flex: 1; min-width: 0; }

.enc-hp-bar-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  transition: filter 0.2s, opacity 0.2s;
}
.enc-hp-bar-wrap--dead { filter: blur(2.5px); opacity: 0.55; }

.enc-hp-nums {
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
}

.enc-hp-temp { color: var(--info); font-size: 10px; }

.enc-ds-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: inherit;
  background: color-mix(in srgb, var(--bg) 35%, transparent);
}

.enc-ds-side { display: flex; gap: 4px; }
.enc-ds-heart {
  color: var(--danger);
  font-size: 14px;
  line-height: 1;
  animation: enc-ds-beat 1.4s ease-in-out infinite;
}
@keyframes enc-ds-beat {
  0%, 100% { transform: scale(1);    opacity: 0.8; }
  20%       { transform: scale(1.25); opacity: 1;   }
  40%       { transform: scale(1);    opacity: 0.8; }
}

.enc-ds-pip {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 1px solid var(--surface-active);
  background: var(--surface-raised);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.12s;
}
.enc-ds-pip:hover { transform: scale(1.18); }
.enc-ds-pip--succ.enc-ds-pip--filled {
  background: var(--success);
  border-color: var(--success);
  box-shadow: 0 0 7px color-mix(in srgb, var(--success) 35%, transparent);
}
.enc-ds-pip--fail.enc-ds-pip--filled {
  background: var(--danger);
  border-color: var(--danger);
  box-shadow: 0 0 7px color-mix(in srgb, var(--danger) 35%, transparent);
}

.enc-ds-overlay--npc {
  gap: 10px;
  background: color-mix(in srgb, var(--bg) 45%, transparent);
}
.enc-skull {
  font-size: 16px;
  line-height: 1;
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--danger) 55%, transparent));
}
.enc-graveyard-btn {
  background: color-mix(in srgb, var(--danger) 18%, transparent);
  color: var(--danger);
  border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
  border-radius: 6px;
  padding: 3px 9px;
  font-family: inherit;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.enc-graveyard-btn:hover {
  background: color-mix(in srgb, var(--danger) 32%, transparent);
  border-color: color-mix(in srgb, var(--danger) 65%, transparent);
}

.enc-revive-btn {
  background: color-mix(in srgb, var(--success) 16%, transparent);
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 40%, transparent);
}
.enc-revive-btn:hover {
  background: color-mix(in srgb, var(--success) 28%, transparent);
  border-color: color-mix(in srgb, var(--success) 65%, transparent);
}
</style>
