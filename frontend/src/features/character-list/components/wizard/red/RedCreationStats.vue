<template>
  <div class="red-stack red-creation-stats">
    <RedCreationIntro title="Характеристики" :cover="art.dictionaryCover('Характеристики')" />

    <div class="stat-setup">
      <p v-if="manual" class="stat-help">
        Распредели {{ profile.statBudget }} очка. Каждая характеристика от {{ profile.statMin }} до {{ profile.statMax }}.
      </p>
      <p v-else class="stat-help">
        {{ streetrat ? 'Один d10 выбирает целую строку из таблицы роли.' : 'Каждый d10 выбирает строку таблицы для своей характеристики.' }}
      </p>
      <p v-if="manual" class="stat-budget" :class="{ 'red-danger': remaining < 0 }" role="status">
        {{ remaining < 0 ? 'Сверх бюджета' : 'Осталось очков' }} <strong>{{ Math.abs(remaining) }}</strong>
      </p>
      <div v-else class="stat-roll-action">
        <div v-if="streetrat && rolled" class="stat-row-result" role="status">
          <SystemDie :sides="10" :value="rolls[0]" :size="38" :animated="false" />
          <span>Строка {{ rolls[0] }}</span>
        </div>
        <ActionButton @click="emit('roll')">
          <template #icon><Dices :size="18" aria-hidden="true" /></template>
          {{ rolled ? 'Перебросить' : streetrat ? 'Бросить d10' : 'Бросить 10d10' }}
        </ActionButton>
      </div>
    </div>
    <p v-if="!manual && !rolled" class="stat-help" role="status">Сделай бросок, чтобы получить характеристики.</p>

    <div class="stat-grid">
      <BaseTile v-for="(stat, index) in RED_STATS" :key="stat.key" :outlined="false">
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
            <template v-else>
              <strong :class="{ 'stat-pending': !rolled }">{{ rolled ? stats[stat.key] : '—' }}</strong>
              <SystemDie v-if="rolled && !streetrat" :sides="10" :value="rolls[index]" :size="36" :animated="false" />
            </template>
          </div>
        </article>
      </BaseTile>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Dices } from '@lucide/vue'
import { ActionButton, BaseTile, FormNumberInput } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import SystemDie from '@/shared/ui/SystemDie.vue'
import { RED_STATS } from '@/features/character-editor/settings/cyberpunk-red/catalogue'
import { RED_CORE_PROFILE as profile } from '@/features/character-editor/settings/cyberpunk-red/creation'
import RedCreationIntro from './RedCreationIntro.vue'

const props = defineProps({
  method: { type: String, required: true },
  stats: { type: Object, required: true },
  rolls: { type: Array, required: true },
  art: { type: Object, required: true },
})
const emit = defineEmits(['patch', 'roll'])
const manual = computed(() => props.method === 'complete')
const streetrat = computed(() => props.method === 'streetrat')
const rolled = computed(() => props.rolls.length > 0)
const remaining = computed(() => profile.statBudget - RED_STATS.reduce((total, stat) => total + props.stats[stat.key], 0))

function statDescription(key) {
  const description = props.art.stat(key)?.desc
  return description === key ? '' : description
}
</script>

<style scoped>
.red-creation-stats :deep(.creation-cover) { height: clamp(110px, 19vw, 175px); }
.stat-setup, .stat-roll-action, .stat-row-result, .stat-identity, .stat-value {
  display: flex;
  align-items: center;
  gap: var(--spacing-small);
}
.stat-setup, .stat-roll-action { flex-wrap: wrap; justify-content: space-between; }
.stat-help { margin: 0; color: var(--text-2); font-size: var(--type-row-size); }
.stat-budget { margin: 0; }
.stat-budget strong { margin-inline-start: var(--spacing-small); font-size: var(--type-sheet-stat-size); }
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
  gap: var(--spacing-medium);
}
.stat-card {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-small);
  padding: var(--spacing-medium);
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
.stat-pending { color: var(--text-muted); }
</style>
