<template>
  <div class="red-stack red-creation-stats">
    <RedCreationIntro title="Характеристики" :cover="art.dictionaryCover('Характеристики')" />

    <WizardSectionPanel>
      <div class="stat-setup">
        <div class="stat-instructions">
          <h3>{{ modeName }}</h3>
          <p v-if="manual" class="stat-help">
            Распредели все {{ profile.statBudget }} очка. Значения могут быть от {{ profile.statMin }} до {{ profile.statMax }}.
            Уменьши одну характеристику кнопкой «−», чтобы освободить очко для другой.
          </p>
          <p v-else-if="streetrat" class="stat-help">
            Брось один d10 для всего набора. Если выпало 6, визард возьмёт все десять значений из строки 6 таблицы роли.
          </p>
          <p v-else class="stat-help">
            Брось по d10 на каждую характеристику. Кубик указывает строку, а характеристика — столбец.
            <template v-if="tableRows.length">Например, 6 на INT даёт значение {{ tableRows[5][0] }} из строки 6 столбца INT.</template>
          </p>
        </div>
        <p v-if="manual" class="stat-budget" :class="{ 'red-danger': remaining < 0 }" role="status">
          {{ remaining < 0 ? 'Сверх бюджета' : 'Осталось очков' }} <strong>{{ Math.abs(remaining) }}</strong>
        </p>
        <div v-else class="stat-roll-action">
          <div v-if="streetrat && rolled" :key="rollSequence" class="stat-row-result" :class="{ 'stat-flash': rollSequence }" role="status">
            <SystemDie :sides="10" :value="rolls[0]" :size="38" :animated="false" />
            <span>Строка {{ rolls[0] }}</span>
          </div>
          <ActionButton @click="requestRoll">
            <template #icon><Dices :size="18" aria-hidden="true" /></template>
            {{ rolled ? 'Перебросить' : streetrat ? 'Бросить d10' : 'Бросить 10d10' }}
          </ActionButton>
        </div>
      </div>
      <p v-if="!manual && !rolled" class="stat-help" role="status">Сделай бросок, чтобы получить характеристики.</p>
    </WizardSectionPanel>

    <WizardSectionPanel v-if="!manual && tableRows.length">
      <RedStatRollTable :rows="tableRows" :rolls="rolls" :whole-row="streetrat" :role-name="roleName" />
    </WizardSectionPanel>

    <div class="stat-grid">
      <WizardSectionPanel v-for="(stat, index) in RED_STATS" :key="stat.key">
        <article class="stat-card">
          <div class="stat-identity">
            <ItemIcon v-if="art.stat(stat.key)?.iconImageUrl" :item="art.stat(stat.key)" :size="40" />
            <span class="stat-code">{{ stat.key }}</span>
          </div>
          <h3>{{ art.stat(stat.key)?.value || stat.name }}</h3>
          <p v-if="statDescription(stat.key)" class="stat-description">{{ statDescription(stat.key) }}</p>
          <div class="stat-value">
            <div v-if="manual" role="group" :aria-label="stat.name">
              <FormNumberInput
                :value="stats[stat.key]"
                :min="profile.statMin"
                :max="profile.statMax"
                @change="emit('patch', { stats: { ...stats, [stat.key]: $event } })"
              />
            </div>
            <div v-else :key="rollSequence" class="stat-result" :class="{ 'stat-flash': rolled && rollSequence }">
              <strong :class="{ 'stat-pending': !rolled }">{{ rolled ? stats[stat.key] : '—' }}</strong>
              <SystemDie v-if="rolled && !streetrat" :sides="10" :value="rolls[index]" :size="36" :animated="false" />
            </div>
          </div>
        </article>
      </WizardSectionPanel>
    </div>
    <ConfirmDialog
      v-if="rerollOpen"
      title="Перебросить характеристики?"
      message="Перебрасывают броски слабые духом. Заменить выпавшие результаты?"
      confirm-label="Да, мне не стыдно"
      @cancel="rerollOpen = false"
      @confirm="confirmReroll"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Dices } from '@lucide/vue'
import { ActionButton, ConfirmDialog, FormNumberInput } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import SystemDie from '@/shared/ui/SystemDie.vue'
import WizardSectionPanel from '@/shared/ui/WizardSectionPanel.vue'
import { RED_ROLES, RED_STATS } from '@/features/character-editor/settings/cyberpunk-red/catalogue'
import { RED_CORE_PROFILE as profile } from '@/features/character-editor/settings/cyberpunk-red/creation'
import { RED_STAT_TABLES } from '@/features/character-editor/settings/cyberpunk-red/creationTables'
import RedCreationIntro from './RedCreationIntro.vue'
import RedStatRollTable from './RedStatRollTable.vue'

const props = defineProps({
  method: { type: String, required: true },
  role: { type: String, required: true },
  stats: { type: Object, required: true },
  rolls: { type: Array, required: true },
  art: { type: Object, required: true },
})
const emit = defineEmits(['patch', 'roll'])
const manual = computed(() => props.method === 'complete')
const streetrat = computed(() => props.method === 'streetrat')
const rolled = computed(() => props.rolls.length > 0)
const modeName = computed(() => ({ complete: 'Полный пакет', streetrat: 'Уличная крыса', edgerunner: 'Эджраннер' })[props.method])
const tableRows = computed(() => RED_STAT_TABLES[props.role] || [])
const roleName = computed(() => RED_ROLES.find(role => role.key === props.role)?.name || props.role)
const remaining = computed(() => profile.statBudget - RED_STATS.reduce((total, stat) => total + props.stats[stat.key], 0))
const rerollOpen = ref(false)
const rollSequence = ref(0)
watch(() => props.rolls, rolls => { if (rolls.length) rollSequence.value++ })

function requestRoll() {
  if (rolled.value) rerollOpen.value = true
  else emit('roll')
}

function confirmReroll() {
  rerollOpen.value = false
  emit('roll')
}

function statDescription(key) {
  const description = props.art.stat(key)?.desc
  return description === key ? '' : description
}
</script>

<style scoped>
.red-creation-stats :deep(.creation-cover) {
  height: clamp(110px, 19vw, 175px);
  object-position: center top;
}
.stat-setup, .stat-roll-action, .stat-row-result, .stat-identity, .stat-value {
  display: flex;
  align-items: center;
  gap: var(--spacing-small);
}
.stat-setup, .stat-roll-action { flex-wrap: wrap; justify-content: space-between; }
.stat-instructions { flex: 1 1 400px; }
.stat-instructions h3 { margin: 0 0 var(--spacing-small); font-size: var(--type-row-size); }
.stat-help { margin: 0; color: var(--text-2); font-size: var(--type-row-size); }
.stat-budget { margin: 0; }
.stat-budget strong { margin-inline-start: var(--spacing-small); font-size: var(--type-sheet-stat-size); }
.stat-grid {
  --stat-card-min: 200px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(
    min(100%, max(var(--stat-card-min), calc((100% - 4 * var(--spacing-medium)) / 5))), 1fr
  ));
  gap: var(--spacing-medium);
}
@media (max-width: 599px) {
  .stat-grid { --stat-card-min: 163px; }
}
.stat-card {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-small);
  min-width: 0;
}
.stat-identity { justify-content: space-between; min-height: 40px; }
.stat-code { color: var(--text-muted); font-variant-numeric: tabular-nums; }
.stat-card h3 {
  margin: 0;
  font-size: var(--type-row-size);
  line-height: 1.25;
  overflow-wrap: anywhere;
}
.stat-description {
  margin: 0;
  color: var(--text-2);
  font-size: var(--type-group-size);
  line-height: 1.4;
}
.stat-value {
  margin-block-start: auto;
  justify-content: space-between;
  min-height: 36px;
  padding-block-start: var(--spacing-small);
}
.stat-value strong { font-size: var(--type-sheet-stat-size); line-height: 1; }
.stat-result { display: flex; align-items: center; gap: var(--spacing-small); justify-content: space-between; width: 100%; min-height: 36px; }
.stat-pending { color: var(--text-muted); }
.stat-flash {
  border-radius: var(--r-md);
  animation: red-stat-flash .42s ease-out;
}
@keyframes red-stat-flash {
  from { background-color: color-mix(in srgb, var(--accent) 42%, transparent); }
  to { background-color: transparent; }
}
@media (prefers-reduced-motion: reduce) {
  .stat-flash { animation: none; }
}
</style>
