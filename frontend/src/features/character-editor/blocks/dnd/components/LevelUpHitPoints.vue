<template>
  <BaseTile class="lu-health" color="var(--danger)" framed>
    <div class="lu-health-heading"><HeartPulse :size="18" aria-hidden="true" /><h3>Хиты</h3></div>
    <div class="lu-health-result" aria-live="polite">
      <strong>{{ hp.hpReady ? `+${hp.hpGain}` : '—' }}</strong>
      <div><b>к максимуму хитов</b><span>{{ hp.hpReady ? `${currentMax} → ${currentMax + hp.hpGain}` : 'Бросьте кость, чтобы узнать прирост' }}</span></div>
    </div>
    <MultiToggle :options="modes" :model-value="hp.hpMode" @update:model-value="hp.setHpMode" />
    <div v-if="hp.hpMode === 'manual'" class="lu-health-manual">
      <FormField label="Итоговый прирост" hint="С учётом модификатора Телосложения и договорённостей с мастером.">
        <FormNumberInput :value="hp.hpManual ?? hp.hpAvg" :min="1" :max="99" @change="hp.hpManual = $event" />
      </FormField>
    </div>
    <template v-else>
      <div class="lu-health-formula">
        <div class="lu-health-term">
          <SystemDie v-if="hp.hpMode === 'roll' && hp.hpRoll == null" :sides="sides" :size="38" color="var(--danger)" />
          <strong v-else>{{ hp.hpDie }}</strong>
          <small>{{ hp.hpMode === 'avg' ? `Среднее ${dieLabel}` : `Бросок ${dieLabel}` }}</small>
        </div>
        <span class="lu-health-sign">{{ hp.conMod < 0 ? '−' : '+' }}</span>
        <div class="lu-health-term"><strong>{{ Math.abs(hp.conMod) }}</strong><small>Модификатор ТЕЛ</small></div>
      </div>
      <ActionButton v-if="hp.hpMode === 'roll'" variant="secondary" @click="hp.rollHp">
        <template #icon><Dices :size="16" aria-hidden="true" /></template>
        {{ hp.hpRoll == null ? `Бросить ${dieLabel}` : 'Перебросить' }}
      </ActionButton>
      <p v-else class="lu-health-note">Фиксированное значение кости, округлённое вверх.</p>
      <p v-if="hp.hpReady && hp.hpDie + hp.conMod < 1" class="lu-health-note">Минимальный прирост — 1 хит.</p>
    </template>
  </BaseTile>
</template>

<script setup>
import { ActionButton, BaseTile, FormField, FormNumberInput, MultiToggle } from '@sylvieshare/share-ui'
import { HeartPulse, Dices } from '@lucide/vue'
import SystemDie from '@/shared/ui/SystemDie.vue'
defineProps({ hp: { type: Object, required: true }, sides: Number, dieLabel: String, currentMax: Number })
const modes = [{ value: 'avg', label: 'Среднее' }, { value: 'roll', label: 'Бросок' }, { value: 'manual', label: 'Вручную' }]
</script>

<style scoped>
.lu-health { display: flex; flex-direction: column; gap: 18px; padding: 20px; }
.lu-health-heading { display: flex; align-items: center; gap: 8px; color: var(--danger); }
.lu-health-heading h3 { margin: 0; color: var(--text-1); font: 600 20px var(--font-display); }
.lu-health-result { display: flex; align-items: center; gap: 14px; }
.lu-health-result > strong { color: var(--danger); font: 600 46px/1 var(--font-display); font-variant-numeric: tabular-nums; }
.lu-health-result > div { display: grid; gap: 5px; }
.lu-health-result b { color: var(--text-1); font-size: 12px; font-weight: 600; }
.lu-health-result span { color: var(--text-muted); font-size: 12px; }
.lu-health-formula { display: flex; align-items: center; justify-content: center; gap: 22px; padding-block: 4px; }
.lu-health-term { display: grid; justify-items: center; gap: 7px; }
.lu-health-term strong { font-size: 30px; line-height: 38px; color: var(--text-1); }
.lu-health-term small, .lu-health-note { color: var(--text-muted); font-size: 11px; line-height: 1.5; }
.lu-health-note { margin: 0; }
.lu-health-sign { color: var(--text-muted); font-size: 24px; }
</style>
