<template>
  <BaseTile :outlined="false">
    <article class="red-skill-card">
      <div class="skill-identity">
        <ItemIcon :item="art.skill(row.key)" :size="40" placeholder />
        <div class="skill-name">
          <h4>{{ row.name }}</h4>
          <span v-if="row.specialization" class="skill-specialization">{{ row.specialization }}</span>
          <span v-else-if="row.specializationKind" class="skill-specialization">Нужна специализация</span>
        </div>
        <span v-if="creation && row.costMultiplier === 2" class="skill-cost" title="Двойная стоимость очков">×2</span>
      </div>

      <div class="skill-values">
        <span class="skill-stat" :title="statName">
          <ItemIcon :item="art.stat(row.statKey)" :size="18" />
          {{ row.statKey }} <b>{{ statValue }}</b>
        </span>
        <span>Ранг <b>{{ row.rank }}</b></span>
        <span v-if="creation" class="skill-total">База <strong>{{ total }}</strong></span>
      </div>

      <div v-if="!creation || canAdjust" class="skill-actions">
        <ActionButton v-if="canAdjust && row.outsideRole" variant="quiet" @click="emit('remove')">Убрать</ActionButton>
        <div v-else-if="canAdjust && (!row.specializationKind || row.specialization)" role="group" :aria-label="`Ранг навыка «${row.name}»`">
          <FormNumberInput :value="row.rank" :min="0" :max="creation ? 6 : 10" @change="emit('rank', $event)" />
        </div>
        <ActionButton v-if="!creation" class="skill-check" :aria-label="`Бросить ${row.name}`" @click="emit('roll')">
          <template #icon><Dices :size="16" aria-hidden="true" /></template>
          {{ total }}
        </ActionButton>
      </div>
    </article>
  </BaseTile>
</template>

<script setup>
import { computed } from 'vue'
import { Dices } from '@lucide/vue'
import { ActionButton, BaseTile, FormNumberInput } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import { RED_STATS } from '../../../settings/cyberpunk-red/catalogue'

const props = defineProps({
  row: { type: Object, required: true },
  art: { type: Object, required: true },
  statValue: { type: Number, required: true },
  canAdjust: Boolean,
  creation: Boolean,
})
const emit = defineEmits(['rank', 'remove', 'roll'])
const total = computed(() => props.statValue + props.row.rank)
const statName = computed(() => RED_STATS.find(stat => stat.key === props.row.statKey)?.name || props.row.statKey)
</script>

<style scoped>
.red-skill-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-medium);
  min-width: 0;
  height: 100%;
  box-sizing: border-box;
  padding: var(--spacing-medium);
}
.skill-identity, .skill-values, .skill-actions, .skill-stat {
  display: flex;
  align-items: center;
  gap: var(--spacing-small);
}
.skill-name { flex: 1 1 auto; min-width: 0; }
.skill-name h4 { margin: 0; font-size: var(--type-row-size); line-height: 1.3; overflow-wrap: anywhere; }
.skill-specialization { display: block; color: var(--text-muted); overflow-wrap: anywhere; }
.skill-specialization, .skill-values, .skill-cost { font-size: var(--type-group-size); }
.skill-cost { color: var(--accent-soft); }
.skill-values { flex-wrap: wrap; color: var(--text-2); }
.skill-values b { color: var(--text-1); }
.skill-total, .skill-check { margin-inline-start: auto; }
.skill-total strong { color: var(--accent-soft); margin-inline-start: 4px; font-size: var(--type-row-size); }
.skill-actions { flex-wrap: wrap; margin-block-start: auto; }
.skill-actions:empty { display: none; }
</style>
