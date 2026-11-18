<template>
  <BaseTile :outlined="false" :class="{ 'skill-row-shell': creation }">
    <article class="red-skill-card" :class="{ 'red-skill-card--row': creation }">
      <div class="skill-identity">
        <ItemIcon :item="art.skill(row.key)" :size="creation ? 36 : 40" placeholder />
        <div class="skill-name">
          <div class="skill-title">
            <FitContent v-if="creation" tag="h4" inline class="skill-title-fit" :min-scale="0.66" :title="row.name">
              {{ row.name }}
            </FitContent>
            <h4 v-else>{{ row.name }}</h4>
            <ActionButton
              v-if="description"
              class="skill-help"
              variant="quiet"
              icon-only
              :aria-label="`Описание навыка «${row.name}»`"
              aria-haspopup="dialog"
              :aria-expanded="!!descriptionAnchor"
              @click="descriptionAnchor = descriptionAnchor ? null : $event.currentTarget"
            >
              <template #icon><CircleHelp :size="16" aria-hidden="true" /></template>
            </ActionButton>
            <ItemTooltip
              v-if="descriptionAnchor"
              interactive
              :anchor="descriptionAnchor"
              :title="row.name"
              :desc="description"
              @close="descriptionAnchor = null"
            />
          </div>
          <span v-if="row.specialization" class="skill-specialization">{{ row.specialization }}</span>
          <span v-else-if="row.specializationKind" class="skill-specialization">Нужна специализация</span>
        </div>
        <span v-if="creation && row.costMultiplier === 2" class="skill-cost" title="Двойная стоимость очков">×2</span>
      </div>

      <div v-if="creation" class="skill-formula">
        <div class="formula-term">
          <div class="formula-value"><strong>{{ statValue }}</strong></div>
          <span class="formula-caption formula-stat">
            <ItemIcon :item="art.stat(row.statKey)" :size="16" />
            <FitContent inline class="formula-stat-name" :min-scale="0.64" :title="statName">{{ statName }}</FitContent>
          </span>
        </div>
        <span class="formula-operator">+</span>
        <div class="formula-term">
          <div class="formula-value">
            <div v-if="editableRank" class="formula-rank" role="group" :aria-label="`Ранг навыка «${row.name}»`">
              <FormNumberInput :value="row.rank" :min="0" :max="RED_CORE_PROFILE.skillMax" live @change="emit('rank', $event)" />
            </div>
            <strong v-else>{{ row.rank }}</strong>
          </div>
          <span class="formula-caption">Ранг</span>
        </div>
        <span class="formula-operator">=</span>
        <div class="formula-term">
          <div class="formula-value formula-base"><strong>{{ total }}</strong></div>
          <span class="formula-caption">База</span>
        </div>
      </div>

      <div v-else class="skill-values">
        <span class="skill-stat" :title="statName">
          <ItemIcon :item="art.stat(row.statKey)" :size="18" />
          {{ row.statKey }} <b>{{ statValue }}</b>
        </span>
        <span>Ранг <b>{{ row.rank }}</b></span>
      </div>

      <RedSkillRankBar
        v-if="creation"
        class="skill-rank"
        :rank="row.rank"
        :editable="editableRank"
        :label="`Шкала ранга навыка «${row.name}»`"
        @select="emit('rank', $event)"
      />

      <div v-if="!creation || (canAdjust && row.outsideRole)" class="skill-actions">
        <ActionButton v-if="canAdjust && row.outsideRole" variant="quiet" @click="emit('remove')">Убрать</ActionButton>
        <div v-else-if="editableRank" role="group" :aria-label="`Ранг навыка «${row.name}»`">
          <FormNumberInput :value="row.rank" :min="0" :max="10" @change="emit('rank', $event)" />
        </div>
        <ActionButton v-if="!creation" class="skill-check" :aria-label="rollLabel" @click="emit('roll')">
          <template #icon><Dices :size="16" aria-hidden="true" /></template>
          {{ total }}
        </ActionButton>
      </div>
    </article>
  </BaseTile>
</template>

<script setup>
import { computed, shallowRef } from 'vue'
import { CircleHelp, Dices } from '@lucide/vue'
import { ActionButton, BaseTile, FitContent, FormNumberInput } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip.vue'
import { RED_STATS } from '../../../settings/cyberpunk-red/catalogue'
import { RED_CORE_PROFILE } from '../../../settings/cyberpunk-red/creation'
import { RED_SKILL_DESCRIPTIONS } from '../../../settings/cyberpunk-red/descriptions'
import RedSkillRankBar from './RedSkillRankBar.vue'

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
const description = computed(() => RED_SKILL_DESCRIPTIONS[props.row.key])
const descriptionAnchor = shallowRef(null)
const rollLabel = computed(() => `Бросить ${props.row.name}${props.row.specialization ? ` — ${props.row.specialization}` : ''}`)
const editableRank = computed(() => props.canAdjust && !props.row.outsideRole && (!props.row.specializationKind || !!props.row.specialization))
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
.skill-row-shell { container: skill-row / inline-size; --tile-surface: var(--bg); }
.red-skill-card--row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 224px);
  align-items: center;
  row-gap: var(--spacing-xs);
  column-gap: var(--spacing-small);
}
.red-skill-card--row .skill-formula { margin-block-start: 0; }
.red-skill-card--row .skill-actions, .skill-rank { grid-column: 1 / -1; }
.skill-identity, .skill-values, .skill-actions, .skill-stat {
  display: flex;
  align-items: center;
  gap: var(--spacing-small);
}
.skill-name { flex: 1 1 auto; min-width: 0; }
.skill-title { display: flex; align-items: center; gap: 2px; min-width: 0; }
.skill-name h4 { min-width: 0; margin: 0; font-size: var(--type-row-size); line-height: 1.3; overflow-wrap: anywhere; }
.skill-help { --action-button-icon-size: 26px; }
.skill-specialization { display: block; color: var(--text-muted); overflow-wrap: anywhere; }
.skill-specialization, .skill-values, .skill-cost { font-size: var(--type-group-size); }
.skill-cost { color: var(--accent-soft); }
.skill-values { flex-wrap: wrap; color: var(--text-2); }
.skill-values b { color: var(--text-1); }
.skill-check { margin-inline-start: auto; }
.skill-formula {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(104px, max-content) auto minmax(35px, .42fr);
  column-gap: 4px;
  align-items: start;
  margin-block-start: auto;
  font-variant-numeric: tabular-nums;
}
.formula-term { display: grid; gap: 2px; min-width: 0; text-align: center; }
.formula-value, .formula-operator { display: grid; place-items: center; min-height: 36px; }
.formula-value strong { font-size: var(--type-sheet-stat-size); line-height: 1; }
.formula-operator { color: var(--text-muted); }
.formula-base { color: var(--accent-soft); }
.formula-caption {
  color: var(--text-muted);
  font-size: var(--type-group-size);
  line-height: 1.2;
}
.formula-stat { display: flex; align-items: center; justify-content: center; gap: 3px; }
.formula-stat-name { flex: 0 1 auto; min-width: 0; overflow-wrap: anywhere; }
.skill-actions { flex-wrap: wrap; margin-block-start: auto; }
.skill-actions:empty { display: none; }
@container skill-row (max-width: 390px) {
  .red-skill-card--row { grid-template-columns: minmax(0, 1fr); }
  .red-skill-card--row .skill-formula {
    --skill-icon-inset: calc(36px + var(--spacing-small));
    width: min(calc(100% - var(--skill-icon-inset)), 260px);
    margin-inline-start: var(--skill-icon-inset);
  }
}
@container skill-row (max-width: 331px) {
  .red-skill-card--row .skill-formula {
    width: min(100%, 260px);
    margin-inline-start: 0;
  }
}
</style>
