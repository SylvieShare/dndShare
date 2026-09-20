<template>
  <div class="step">
    <IllustratedChoiceStage
      title="Раса"
      :selected="!!state.race"
      :selection-key="state.race?.id"
      :loading="loading && !races.length && !state.race"
      :empty="!loading && !races.length && !state.race"
      empty-text="В справочнике пока нет рас."
      back-text="К выбору расы"
      @clear="state.race = null"
    >
      <template #cards>
        <RaceSelectCard
          v-for="r in visibleRaces"
          :key="r.id"
          :title="r.name"
          :subtitle="asiSummary(r)"
          :monogram="monogramOf(r.name)"
          :image-url="raceCoverFor(r)"
          :description="summaryFor(r).description"
          :facts="summaryFor(r).facts"
          :choices="summaryFor(r).choices"
          :subraces="summaryFor(r).subraces"
          :selected="state.race?.id === r.id"
          @select="selectRace(r)"
        />
      </template>

      <template #details>
        <div ref="detailsRef" class="race-details">
          <RaceAbilityList :abilities="selectedAbilities" hide-choice-only />
          <RaceSpellList :abilities="selectedAbilities" />
          <p v-if="sizeDescription && !grants.raceVariants" class="choice-description">{{ sizeDescription }}</p>
          <section v-if="raceDesc" class="race-lore">
            <div class="sheet-section-title">О расе</div>
            <RichContent class="step-desc" :html="raceDesc" />
          </section>

        <section v-if="hasRaceChoices" class="race-choices">
          <div class="choices-title">Выборы расы</div>
          <div class="choice-stack">
            <RaceSubracePicker v-if="subraces.length" v-model="state.subrace" :options="subraces" :race-id="state.race?.id" :abilities="raceAbilities" />

            <RaceVariantPicker v-if="grants.raceVariants" v-model="state.raceVariant" :options="grants.raceVariants" :size-description="sizeDescription" />

            <AbilityBonusPicker
              v-if="grants.asiChoice"
              :model-value="raceAsiSelection"
              :patterns="[Array(grants.asiChoice.count).fill(grants.asiChoice.bonus)]"
              title="Характеристики"
              @update:model-value="state.asiChoice = Object.keys($event)"
            />

            <StepSkills v-if="grants.raceSkillChoice" source="race" class="choice-block" />

            <section v-if="grants.langChoice" class="choice-block">
              <div class="choice-heading">
                <div class="choice-label">Дополнительный язык</div>
                <span class="choice-count" :class="{ done: raceLangsComplete }">{{ state.raceLangIds.length }} / {{ raceLangLimit }}</span>
              </div>
              <MultiSearchSelect
                :options="raceLangOptions"
                :selected="state.raceLangIds"
                :limit="raceLangLimit"
                :suggest-type-id="6"
                allow-create
                placeholder="Найти язык…"
                @toggle="toggleRaceLang"
              />
            </section>

            <section v-if="grants.featChoice" class="choice-block">
              <div class="choice-heading">
                <div class="choice-label">Черта на выбор</div>
                <span class="choice-count" :class="{ done: featComplete }">{{ state.featIds.length }} / {{ featLimit }}</span>
              </div>
              <div v-if="state.featIds.length" class="feat-tags">
                <div v-for="id in state.featIds" :key="id" class="feat-tag">
                  <span class="feat-tag-name">{{ featName(id) }}</span>
                  <button class="feat-x" title="Убрать" @click="toggleFeat(id)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </div>
              </div>
              <button v-if="state.featIds.length < featLimit" class="feat-add" @click="pickerOpen = true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                Выбрать черту
              </button>
            </section>

            <StepChoices v-if="raceFeatureChoices.length" scope="race" class="choice-block" />
          </div>
        </section>
        </div>
      </template>
    </IllustratedChoiceStage>

    <ItemPickerModal
      v-if="pickerOpen"
      :item-type-ids="[7]"
      title="Выбор черты"
      search-placeholder="Поиск черты…"
      :item-eligibility="featEligibility"
      :default-filters="state.version === '2024' ? { category: ['origin'] } : {}"
      @pick="onFeatPick"
      @close="pickerOpen = false"
    />

    <FeatChoiceModal
      v-if="featConfigItem"
      :item="featConfigItem"
      :initial-choices="state.featSelections?.[featConfigItem.id] || {}"
      @confirm="onFeatChoicesConfirm"
      @close="featConfigItem = null"
    />
  </div>
</template>

<script setup>
import { computed, inject, nextTick, ref } from 'vue'
import RaceSpellList from '@/features/items/components/RaceSpellList.vue'
import RaceAbilityList from '@/features/items/components/RaceAbilityList.vue'
import RaceVariantPicker from '../RaceVariantPicker.vue'
import { featuresForBinding } from '@/features/character-editor/settings/dnd/creation/progression'
import AbilityBonusPicker from '@/shared/ui/AbilityBonusPicker.vue'
import FeatChoiceModal from '@/features/character-editor/components/FeatChoiceModal.vue'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import { actionableItemChoices } from '@/features/items/lib/itemChoices'
import MultiSearchSelect from '@/features/character-list/components/wizard/MultiSearchSelect.vue'
import IllustratedChoiceStage from '@/features/character-list/components/wizard/IllustratedChoiceStage.vue'
import RaceSelectCard from '@/features/character-list/components/wizard/RaceSelectCard.vue'
import { raceCardSummary } from '@/features/character-list/components/wizard/raceCardSummary'
import RichContent from '@/shared/ui/DndRichContent.vue'
import RaceSubracePicker from '../RaceSubracePicker.vue'
import { raceCoverFor } from '@/features/character-list/components/wizard/raceVisuals'
import StepChoices from '@/features/character-list/components/wizard/steps/StepChoices.vue'
import StepSkills from '@/features/character-list/components/wizard/steps/StepSkills.vue'
import { asiSummary, monogramOf } from '@/features/character-list/components/wizard/labels'

const {
  races, subraces, state, loading, grants,
  raceAbilities, raceSubraceNames, suggestValue,
  raceLangOptions, raceLangLimit, toggleRaceLang, raceLangsComplete,
  featPool, featLimit, toggleFeat, setFeatSelection, featEligibility, featComplete, raceFeatureChoices,
} = inject('createWizard')
const raceDesc = computed(() => state.race?.data?.description || '')
const selectedAbilities = computed(() => featuresForBinding(raceAbilities.value, { raceId: state.race?.id }, 20))
const sizeDescription = computed(() => state.subrace?.data?.size_description || state.race?.data?.size_description || '')
const visibleRaces = computed(() => state.race ? [state.race] : races.value)
const raceAsiSelection = computed(() => Object.fromEntries(state.asiChoice.map(stat => [stat, grants.value.asiChoice?.bonus || 0])))
const hasRaceChoices = computed(() => {
  const g = grants.value
  return subraces.value.length || g.raceVariants || g.asiChoice || g.raceSkillChoice || g.langChoice || g.featChoice || raceFeatureChoices.value.length
})

const pickerOpen = ref(false)
const featConfigItem = ref(null)
const detailsRef = ref(null)

function summaryFor(race) {
  return raceCardSummary({
    race,
    selected: state.race?.id === race.id,
    raceVariant: state.race?.id === race.id ? state.raceVariant : null,
    subrace: state.race?.id === race.id ? state.subrace : null,
    raceAbilities: raceAbilities.value,
    suggestValue,
    subraces: raceSubraceNames(race.id),
  })
}
function selectRace(race) {
  if (state.race?.id === race.id) return
  state.race = race
  if (window.matchMedia?.('(max-width: 640px)').matches) {
    nextTick(() => detailsRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
}
function featName(id) { return featPool.value.find((f) => f.id === id)?.name || `#${id}` }
function onFeatPick(item) {
  if (item?.id == null) return
  pickerOpen.value = false
  if (actionableItemChoices(item).length) featConfigItem.value = item
  else setFeatSelection(item, {})
}
function onFeatChoicesConfirm(choices) {
  setFeatSelection(featConfigItem.value, choices)
  featConfigItem.value = null
}
</script>

<style scoped>
.step { position: relative; display: flex; flex-direction: column; gap: 12px; }
.race-details { display: flex; flex-direction: column; scroll-margin-top: 12px; gap: 16px; }
.race-lore { display: flex; flex-direction: column; gap: 7px; }
.step-gap { margin-top: 8px; }
.step-desc {
  font-size: 13px; color: var(--text-2); line-height: 1.5;
  background: var(--surface); border-radius: var(--r-md);
  border-left: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  padding: 11px 14px;
}
.hint { font-size: 12px; color: var(--text-muted); margin: 0; display: flex; align-items: center; gap: 8px; }
.count { font-size: 12px; font-weight: 600; color: var(--text-muted); }
.count.done { color: var(--success); }

.race-choices { display: flex; flex-direction: column; gap: 11px; margin-top: 8px; }
.choices-title {
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: 21px;
  font-weight: 700;
  line-height: 1.15;
}
.choice-stack { display: flex; flex-direction: column; gap: 10px; }
.choice-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
  border-radius: calc(var(--r-md) + 2px);
  background: color-mix(in srgb, var(--surface) 54%, transparent);
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--accent) 22%, transparent);
}

.choice-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.choice-label {
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 700;
  line-height: 1.15;
}
.choice-description { margin: 4px 0 0; color: var(--text-2); font-size: 13px; line-height: 1.4; }
.choice-count {
  flex: 0 0 auto;
  min-width: 48px;
  padding: 6px 9px;
  border: 1px solid color-mix(in srgb, var(--border) 84%, transparent);
  border-radius: 999px;
  background: var(--surface-raised);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  text-align: center;
}
.choice-count.done {
  border-color: color-mix(in srgb, var(--success) 38%, var(--border));
  background: color-mix(in srgb, var(--success) 12%, var(--surface));
  color: var(--success);
}
.feat-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.feat-tag {
  display: inline-flex; align-items: center; gap: 8px;
  background: color-mix(in srgb, var(--accent) 14%, var(--surface));
  border-radius: 999px; padding: 6px 8px 6px 14px;
}
.feat-tag-name { font-size: 13px; color: var(--text-1); font-weight: 500; }
.feat-x {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border: none; border-radius: 50%;
  background: color-mix(in srgb, var(--text-on-accent) 8%, transparent); color: var(--text-2); cursor: pointer;
}
.feat-x:hover { background: var(--danger); color: var(--text-on-accent); }
.feat-x svg { width: 12px; height: 12px; }
.feat-add {
  align-self: flex-start;
  display: inline-flex; align-items: center; gap: 7px;
  background: var(--surface); border: none; border-radius: var(--r-md);
  color: var(--accent); font: inherit; font-size: 13px; font-weight: 600;
  padding: 9px 15px; cursor: pointer; transition: background 0.15s;
}
.feat-add:hover { background: color-mix(in srgb, var(--accent) 14%, var(--surface)); }
.feat-add svg { width: 16px; height: 16px; }

@media (max-width: 430px) {
  .choice-block { padding: 14px; }
}

</style>
