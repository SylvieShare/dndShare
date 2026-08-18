<template>
  <div class="step">
    <IllustratedChoiceStage
      title="Раса"
      :selected="!!state.race"
      :selection-key="state.race?.id"
      :loading="loading && !races.length"
      :empty="!loading && !races.length"
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
          :image-url="raceImageFor(r)"
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
          <section v-if="raceDesc" class="race-lore">
            <div class="sheet-section-title">О расе</div>
            <RichContent class="step-desc" :html="raceDesc" />
          </section>

        <template v-if="subraces.length">
          <div class="sheet-section-title step-gap">Происхождение</div>
          <div class="subrace-grid">
            <SubraceSelectCard
              v-for="s in subraces"
              :key="s.id"
              :title="s.name"
              :subtitle="asiSummary(s)"
              :description="s.data?.description || ''"
              :monogram="monogramOf(s.name)"
              :image-url="s.iconImageUrl || ''"
              :selected="state.subrace?.id === s.id"
              @select="state.subrace = s"
            />
          </div>
        </template>

        <section v-if="hasRaceChoices" class="race-choices">
          <div class="choices-title">Выборы расы</div>
          <div class="choice-stack">

            <section v-if="grants.raceVariants" class="choice-block">
              <div class="choice-label">Вариант расы</div>
              <div class="opts">
                <div
                  v-for="v in grants.raceVariants"
                  :key="v.value"
                  class="opt"
                  :class="{ on: state.raceVariant === v.value }"
                  @click="state.raceVariant = v.value"
                >
                  <span class="box radio"><svg v-if="state.raceVariant === v.value" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6" /></svg></span>
                  <div class="opt-body">
                    <div class="opt-label">{{ v.label }}</div>
                    <div v-if="v.desc" class="opt-desc">{{ v.desc }}</div>
                  </div>
                </div>
              </div>
            </section>

            <section v-if="grants.asiChoice" class="choice-block choice-block--asi">
              <div class="choice-heading">
                <div>
                  <div class="choice-label">Характеристики</div>
                  <p class="choice-description">Прибавь +{{ grants.asiChoice.bonus }} к {{ grants.asiChoice.count }} характеристикам на выбор</p>
                </div>
                <span class="choice-count" :class="{ done: state.asiChoice.length === grants.asiChoice.count }">{{ state.asiChoice.length }} / {{ grants.asiChoice.count }}</span>
              </div>
              <div class="asi-chips">
                <button
                  v-for="s in STATS"
                  :key="s"
                  class="asi-chip"
                  :class="{ on: state.asiChoice.includes(s), off: !state.asiChoice.includes(s) && atAsiLimit }"
                  @click="toggleAsiChoice(s)"
                >
                  <span>{{ STAT_SHORT[s] }}</span>
                  <b>+{{ grants.asiChoice.bonus }}</b>
                </button>
              </div>
            </section>

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
import FeatChoiceModal from '@/features/character-editor/components/FeatChoiceModal.vue'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import { featChoices } from '@/features/items/lib/featRules'
import MultiSearchSelect from '@/features/character-list/components/wizard/MultiSearchSelect.vue'
import IllustratedChoiceStage from '@/features/character-list/components/wizard/IllustratedChoiceStage.vue'
import RaceSelectCard from '@/features/character-list/components/wizard/RaceSelectCard.vue'
import { raceCardSummary } from '@/features/character-list/components/wizard/raceCardSummary'
import RichContent from '@/shared/ui/DndRichContent.vue'
import SubraceSelectCard from '@/features/character-list/components/wizard/SubraceSelectCard.vue'
import { raceImageFor } from '@/features/character-list/components/wizard/raceVisuals'
import StepChoices from '@/features/character-list/components/wizard/steps/StepChoices.vue'
import StepSkills from '@/features/character-list/components/wizard/steps/StepSkills.vue'
import { STAT_SHORT, asiSummary, monogramOf } from '@/features/character-list/components/wizard/labels'

const {
  races, subraces, state, loading, grants, STATS, toggleAsiChoice,
  raceAbilities, raceSubraceNames, suggestValue,
  raceLangOptions, raceLangLimit, toggleRaceLang, raceLangsComplete,
  featPool, featLimit, toggleFeat, setFeatSelection, featEligibility, featComplete, raceFeatureChoices,
} = inject('createWizard')
const raceDesc = computed(() => state.race?.data?.description || '')
const visibleRaces = computed(() => state.race ? [state.race] : races.value)
const atAsiLimit = computed(() => grants.value.asiChoice && state.asiChoice.length >= grants.value.asiChoice.count)
const hasRaceChoices = computed(() => {
  const g = grants.value
  return g.raceVariants || g.asiChoice || g.raceSkillChoice || g.langChoice || g.featChoice || raceFeatureChoices.value.length
})

const pickerOpen = ref(false)
const featConfigItem = ref(null)
const detailsRef = ref(null)

function summaryFor(race) {
  return raceCardSummary({
    race,
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
  if (featChoices(item).length) featConfigItem.value = item
  else setFeatSelection(item, {})
}
function onFeatChoicesConfirm(choices) {
  setFeatSelection(featConfigItem.value, choices)
  featConfigItem.value = null
}
</script>

<style scoped>
.step { position: relative; display: flex; flex-direction: column; gap: 12px; }
.race-details { display: flex; flex-direction: column; scroll-margin-top: 12px; }
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
.subrace-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }

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
.choice-block--asi {
  border-color: color-mix(in srgb, var(--accent) 20%, var(--border));
  background:
    radial-gradient(circle at 100% 0, color-mix(in srgb, var(--accent) 10%, transparent), transparent 42%),
    color-mix(in srgb, var(--surface) 68%, transparent);
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--accent) 58%, transparent);
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
.opts { display: flex; flex-wrap: wrap; gap: 8px; }
.opt {
  display: flex; align-items: flex-start; gap: 11px; flex: 1 1 220px;
  background: var(--surface); border-radius: var(--r-md); padding: 11px 13px; cursor: pointer; transition: background 0.15s;
}
.opt:hover { background: color-mix(in srgb, var(--accent) 12%, var(--surface)); }
.opt.on { background: color-mix(in srgb, var(--accent) 16%, var(--surface)); }
.opt.off { opacity: 0.45; }
.box { flex-shrink: 0; width: 18px; height: 18px; margin-top: 1px; border-radius: 50%; background: var(--surface-raised); display: flex; align-items: center; justify-content: center; }
.opt.on .box { background: var(--accent); }
.box svg { width: 12px; height: 12px; color: var(--text-on-accent); }
.opt-body { min-width: 0; }
.opt-label { font-size: 14px; color: var(--text-1); font-weight: 500; }
.opt-desc { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

.asi-chips { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
.asi-chip {
  min-height: 56px;
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  border-radius: 12px;
  background: var(--surface-raised);
  color: var(--text-1);
  font: inherit;
  cursor: pointer;
  transition: transform .16s ease, background .16s ease, border-color .16s ease, box-shadow .16s ease, opacity .16s ease;
}
.asi-chip span { font-family: var(--font-ui); font-size: 15px; font-weight: 700; letter-spacing: .035em; }
.asi-chip b { color: var(--accent); font-size: 14px; font-variant-numeric: tabular-nums; }
.asi-chip:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  background: color-mix(in srgb, var(--accent) 10%, var(--surface-raised));
  box-shadow: 0 7px 18px color-mix(in srgb, var(--accent) 10%, transparent);
}
.asi-chip.on {
  border-color: color-mix(in srgb, var(--accent) 76%, transparent);
  background: var(--accent);
  color: var(--text-on-accent);
  box-shadow: 0 8px 20px color-mix(in srgb, var(--accent) 22%, transparent);
}
.asi-chip.on b { color: var(--text-on-accent); }
.asi-chip.off { opacity: 0.4; cursor: default; }
.asi-chip.off:hover { transform: none; border-color: color-mix(in srgb, var(--border) 88%, transparent); background: var(--surface-raised); box-shadow: none; }

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

@media (max-width: 760px) {
  .asi-chips { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 430px) {
  .choice-block { padding: 14px; }
  .asi-chips { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .subrace-grid { grid-template-columns: minmax(0, 1fr); }
}

</style>
