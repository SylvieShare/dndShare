<template>
  <div class="step">
    <h1 class="class-step-title">Класс</h1>
    <p v-if="loading && !classes.length" class="step-muted">Загрузка справочника…</p>
    <p v-else-if="!classes.length" class="step-muted">В справочнике пока нет классов.</p>
    <template v-else>
      <Transition name="class-back">
        <button v-if="state.charClass" type="button" class="class-back" @click="clearClass">
          <span class="class-back-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
          </span>
          <span><span class="class-back-label">Назад</span><span class="class-back-note">К выбору класса</span></span>
        </button>
      </Transition>

      <TransitionGroup ref="classStage" name="class-list" tag="div" class="class-grid">
        <ClassSelectCard
          v-for="c in visibleClasses"
          :key="c.id"
          :title="c.name"
          :subtitle="classSummary(c, suggestValue)"
          :monogram="monogramOf(c.name)"
          :image-url="c.iconImageUrl || ''"
          :description="summaryFor(c).description"
          :facts="summaryFor(c).facts"
          :choices="summaryFor(c).choices"
          :subclasses="summaryFor(c).subclasses"
          :subclass-level="summaryFor(c).subclassLevel"
          :selected="state.charClass?.id === c.id"
          @select="selectClass(c)"
        />
      </TransitionGroup>

      <Transition name="choice-panel">
        <div v-if="state.charClass" :key="state.charClass.id" class="selection-details">
          <section v-if="classDesc" class="class-lore">
            <div class="sheet-section-title">О классе</div>
            <RichContent class="step-desc" :html="classDesc" />
          </section>

          <section v-if="subclasses.length && subclassAtCreation" class="class-choice-block">
            <div class="sheet-section-title">Архетип</div>
            <div class="subclass-grid">
              <SelectTile
                v-for="s in subclasses"
                :key="s.id"
                :title="s.name"
                :monogram="monogramOf(s.name)"
                :image-url="s.iconImageUrl || ''"
                :svg="s.svg || ''"
                :selected="state.subclass?.id === s.id"
                @select="state.subclass = s"
              />
            </div>
            <RichContent v-if="subclassDesc" class="subclass-desc" :html="subclassDesc" />
          </section>

          <StepClassEquipment class="class-choice-block" />
          <StepSkills v-if="skillOptions.length" class="class-choice-block" />
          <StepChoices v-if="classFeatureChoices.length" scope="class" class="class-choice-block" />
          <section v-if="isCaster" class="class-choice-block">
            <div class="sheet-section-title">Заклинания</div>
            <StepSpells />
          </section>
          <section class="class-result-block"><ChoiceResult source="class" /></section>
        </div>
      </Transition>
    </template>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, ref } from 'vue'
import RichContent from '@/shared/ui/DndRichContent.vue'
import ChoiceResult from '@/features/character-list/components/wizard/ChoiceResult.vue'
import ClassSelectCard from '@/features/character-list/components/wizard/ClassSelectCard.vue'
import { classCardSummary } from '@/features/character-list/components/wizard/classCardSummary'
import SelectTile from '@/features/character-list/components/wizard/SelectTile.vue'
import StepChoices from '@/features/character-list/components/wizard/steps/StepChoices.vue'
import StepClassEquipment from '@/features/character-list/components/wizard/steps/StepClassEquipment.vue'
import StepSkills from '@/features/character-list/components/wizard/steps/StepSkills.vue'
import StepSpells from '@/features/character-list/components/wizard/steps/StepSpells.vue'
import { classSummary, monogramOf } from '@/features/character-list/components/wizard/labels'

const {
  classes, subclasses, state, loading, suggestValue, subclassAtCreation,
  skillOptions, classFeatureChoices, isCaster, classAbilities, classSubclassNames,
} = inject('createWizard')
const classDesc = computed(() => state.charClass?.data?.description || '')
const subclassDesc = computed(() => state.subclass?.data?.description || '')
const visibleClasses = computed(() => state.charClass ? [state.charClass] : classes.value)
const classStage = ref(null)
let classScrollTimer = null

function summaryFor(charClass) {
  return classCardSummary({
    charClass,
    classAbilities: classAbilities.value,
    suggestValue,
    subclasses: classSubclassNames(charClass.id),
  })
}
function scrollToClassStage() {
  const stage = classStage.value?.$el || classStage.value
  requestAnimationFrame(() => stage?.closest('.cc-main')?.scrollTo({
    top: 0,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  }))
}
function scheduleClassScroll() {
  clearTimeout(classScrollTimer)
  classScrollTimer = setTimeout(scrollToClassStage, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 560)
}
function selectClass(charClass) {
  if (state.charClass?.id === charClass.id) return
  state.charClass = charClass
  scheduleClassScroll()
}
function clearClass() {
  if (!state.charClass) return
  clearTimeout(classScrollTimer)
  classScrollTimer = null
  const stage = classStage.value?.$el || classStage.value
  const scroller = stage?.closest('.cc-main')
  const scrollTop = scroller?.scrollTop || 0
  state.charClass = null
  if (scroller && scrollTop > 0) {
    nextTick(() => requestAnimationFrame(() => scroller.scrollTo({ top: scrollTop, behavior: 'auto' })))
  }
}
</script>

<style scoped>
.step { position: relative; display: flex; flex-direction: column; gap: 12px; }
.class-step-title { position: relative; width: fit-content; margin: 0 0 6px; padding-bottom: 9px; color: var(--text-1); font-family: var(--font-display); font-size: clamp(28px, 3.2vw, 36px); font-weight: 700; letter-spacing: .01em; line-height: 1; }
.class-step-title::after { content: ''; position: absolute; left: 1px; bottom: 0; width: 46px; height: 3px; border-radius: 999px; background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 18%, transparent)); }
.step-muted { font-size: 13px; color: var(--text-muted); margin: 0; }
.class-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
.selection-details { display: flex; flex-direction: column; gap: 14px; overflow-anchor: none; }
.class-lore { display: flex; flex-direction: column; gap: 7px; }
.step-desc { padding: 16px 18px; color: var(--text-2); background: var(--surface); border-left: 3px solid color-mix(in srgb, var(--accent) 55%, transparent); border-radius: var(--r-md); font-size: 13px; line-height: 1.65; }
.subclass-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.subclass-desc { color: var(--text-2); font-size: 12px; line-height: 1.5; }
.class-choice-block, .class-result-block { display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 1px solid color-mix(in srgb, var(--border) 80%, transparent); border-radius: var(--r-lg); background: color-mix(in srgb, var(--surface) 68%, transparent); box-shadow: 0 8px 22px color-mix(in srgb, var(--bg) 11%, transparent); }
.class-result-block { border-color: color-mix(in srgb, var(--accent) 22%, var(--border)); }
.class-back { position: absolute; z-index: 3; top: -2px; right: 0; display: inline-flex; align-items: center; gap: 9px; padding: 7px 10px 7px 8px; color: var(--text-2); background: color-mix(in srgb, var(--surface-raised) 92%, transparent); border: 1px solid var(--border); border-radius: 10px; cursor: pointer; font: inherit; text-align: left; box-shadow: var(--shadow-sm); }
.class-back:hover { color: var(--text-1); border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); }
.class-back-icon { display: grid; place-items: center; width: 28px; height: 28px; color: var(--accent); background: color-mix(in srgb, var(--accent) 11%, transparent); border-radius: 8px; }
.class-back-icon svg { width: 16px; height: 16px; }
.class-back-label, .class-back-note { display: block; }
.class-back-label { font-size: 11px; font-weight: 700; line-height: 1.1; }
.class-back-note { margin-top: 2px; color: var(--text-muted); font-size: 9px; line-height: 1.1; }
.class-list-enter-active, .class-list-leave-active, .class-list-move { transition: transform .48s cubic-bezier(.22,1,.36,1), opacity .28s ease, filter .28s ease; }
.class-list-enter-from { opacity: 0; transform: translateY(22px) scale(.985); filter: blur(4px); }
.class-list-leave-active { position: absolute; width: 100%; }
.class-list-leave-to { opacity: 0; transform: translateY(18px) scale(.975); filter: blur(5px); }
.choice-panel-enter-active, .choice-panel-leave-active { transition: transform .3s cubic-bezier(.22,1,.36,1), opacity .22s ease; }
.choice-panel-enter-from { opacity: 0; transform: translateY(16px); }
.choice-panel-leave-to { opacity: 0; transform: translateY(-10px); }
.class-back-enter-active, .class-back-leave-active { transition: opacity .18s ease, transform .22s cubic-bezier(.22,1,.36,1); }
.class-back-enter-from, .class-back-leave-to { opacity: 0; transform: translateX(8px); }
@media (max-width: 640px) { .subclass-grid { grid-template-columns: 1fr; } .class-back-note { display: none; } .class-choice-block, .class-result-block { padding: 13px; } }
@media (prefers-reduced-motion: reduce) { .class-list-enter-active, .class-list-leave-active, .class-list-move, .choice-panel-enter-active, .choice-panel-leave-active, .class-back-enter-active, .class-back-leave-active { transition: none; } }
</style>
