<template>
  <IllustratedChoiceStage
    title="Класс"
    :selected="!!state.charClass"
    :selection-key="state.charClass?.id"
    :loading="loading && !classes.length"
    :empty="!loading && !classes.length"
    empty-text="В справочнике пока нет классов."
    back-text="К выбору класса"
    @clear="state.charClass = null"
  >
    <template #cards>
        <ClassSelectCard
          v-for="c in visibleClasses"
          :key="c.id"
          :title="c.name"
          :subtitle="classSummary(c, suggestValue)"
          :monogram="monogramOf(c.name)"
          :image-url="c.coverImageUrl || ''"
          :description="summaryFor(c).description"
          :facts="summaryFor(c).facts"
          :choices="summaryFor(c).choices"
          :subclasses="summaryFor(c).subclasses"
          :subclass-level="summaryFor(c).subclassLevel"
          :selected="state.charClass?.id === c.id"
          @select="selectClass(c)"
        />
    </template>

    <template #details>
          <section v-if="classDesc" class="class-lore">
            <div class="sheet-section-title">О классе</div>
            <RichContent class="step-desc" :html="classDesc" />
          </section>

          <section v-if="hasClassChoices" class="class-choices">
            <div class="choices-title">Выборы класса</div>
            <div class="choice-stack">
          <section v-if="subclasses.length && subclassAtCreation" class="choice-block">
            <div class="sheet-section-title">Архетип</div>
            <div class="subclass-grid">
              <SelectTile
                v-for="s in subclasses"
                :key="s.id"
                :title="s.name"
                :monogram="monogramOf(s.name)"
                :image-url="s.coverImageUrl || ''"
                :svg="s.svg || ''"
                :selected="state.subclass?.id === s.id"
                @select="state.subclass = s"
              />
            </div>
            <RichContent v-if="subclassDesc" class="subclass-desc" :html="subclassDesc" />
          </section>

          <StepClassEquipment v-if="classEquipmentProfile" class="choice-block" />
          <StepSkills v-if="skillOptions.length" class="choice-block" />
          <StepChoices v-if="classFeatureChoices.length" scope="class" class="choice-block" />
          <section v-if="isCaster" class="choice-block">
            <div class="sheet-section-title">Заклинания</div>
            <StepSpells />
          </section>
            </div>
          </section>
    </template>
  </IllustratedChoiceStage>
</template>

<script setup>
import { computed, inject } from 'vue'
import RichContent from '@/shared/ui/DndRichContent.vue'
import ClassSelectCard from '@/features/character-list/components/wizard/ClassSelectCard.vue'
import IllustratedChoiceStage from '@/features/character-list/components/wizard/IllustratedChoiceStage.vue'
import { classCardSummary } from '@/features/character-list/components/wizard/classCardSummary'
import SelectTile from '@/features/character-list/components/wizard/SelectTile.vue'
import StepChoices from '@/features/character-list/components/wizard/steps/StepChoices.vue'
import StepClassEquipment from '@/features/character-list/components/wizard/steps/StepClassEquipment.vue'
import StepSkills from '@/features/character-list/components/wizard/steps/StepSkills.vue'
import StepSpells from '@/features/character-list/components/wizard/steps/StepSpells.vue'
import { classSummary, monogramOf } from '@/features/character-list/components/wizard/labels'

const {
  classes, subclasses, state, loading, suggestValue, subclassAtCreation,
  skillOptions, classFeatureChoices, isCaster, classAbilities, classSubclassNames, classEquipmentProfile,
} = inject('createWizard')
const classDesc = computed(() => state.charClass?.data?.description || '')
const subclassDesc = computed(() => state.subclass?.data?.description || '')
const visibleClasses = computed(() => state.charClass ? [state.charClass] : classes.value)
const hasClassChoices = computed(() => (
  (subclasses.value.length && subclassAtCreation.value)
  || classEquipmentProfile.value
  || skillOptions.value.length
  || classFeatureChoices.value.length
  || isCaster.value
))

function summaryFor(charClass) {
  return classCardSummary({
    charClass,
    classAbilities: classAbilities.value,
    suggestValue,
    subclasses: classSubclassNames(charClass.id),
  })
}
function selectClass(charClass) {
  if (state.charClass?.id === charClass.id) return
  state.charClass = charClass
}
</script>

<style scoped>
.class-lore { display: flex; flex-direction: column; gap: 7px; }
.step-desc { padding: 16px 18px; color: var(--text-2); background: var(--surface); border-left: 3px solid color-mix(in srgb, var(--accent) 55%, transparent); border-radius: var(--r-md); font-size: 13px; line-height: 1.65; }
.subclass-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.subclass-desc { color: var(--text-2); font-size: 12px; line-height: 1.5; }
.class-choices { display: flex; flex-direction: column; gap: 11px; margin-top: 8px; }
.choices-title { color: var(--text-1); font-family: var(--font-display); font-size: 21px; font-weight: 700; line-height: 1.15; }
.choice-stack { display: flex; flex-direction: column; gap: 10px; }
.choice-block { display: flex; flex-direction: column; gap: 12px; padding: 16px; border: 1px solid color-mix(in srgb, var(--border) 82%, transparent); border-radius: calc(var(--r-md) + 2px); background: color-mix(in srgb, var(--surface) 54%, transparent); box-shadow: inset 3px 0 0 color-mix(in srgb, var(--accent) 22%, transparent); }
@media (max-width: 640px) { .subclass-grid { grid-template-columns: 1fr; } .choice-block { padding: 14px; } }
</style>
