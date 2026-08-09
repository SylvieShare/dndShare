<template>
  <div class="step">
    <div class="sheet-section-title">Класс</div>
    <p v-if="loading && !classes.length" class="step-muted">Загрузка справочника…</p>
    <p v-else-if="!classes.length" class="step-muted">В справочнике пока нет классов.</p>
    <div v-else class="grid">
      <SelectTile
        v-for="c in classes"
        :key="c.id"
        :title="c.name"
        :subtitle="classSummary(c, suggestValue)"
        :monogram="monogramOf(c.name)"
        :selected="state.charClass?.id === c.id"
        @select="selectClass(c)"
      />
    </div>

    <Transition name="choice-panel" mode="out-in" @after-enter="afterClassDetailsEnter">
      <div v-if="state.charClass" :key="state.charClass.id" ref="classDetails" class="selection-details">
        <RichContent v-if="classDesc" class="step-desc" :html="classDesc" />

        <template v-if="subclasses.length">
          <div class="sheet-section-title step-gap">
            Архетип
            <span v-if="!subclassAtCreation" class="step-note">— выбирается на {{ state.charClass.data?.subclass_level }} уровне</span>
          </div>
          <div v-if="subclassAtCreation" class="grid">
            <SelectTile
              v-for="s in subclasses"
              :key="s.id"
              :title="s.name"
              :monogram="monogramOf(s.name)"
              :selected="state.subclass?.id === s.id"
              @select="state.subclass = s"
            />
          </div>
          <p v-else class="step-muted">Пока архетип не нужен — выберешь его позже, при повышении уровня.</p>
          <RichContent v-if="subclassAtCreation && subclassDesc" class="step-desc" :html="subclassDesc" />
        </template>

        <StepClassEquipment class="cls-sub" />
        <StepSkills v-if="skillOptions.length" class="cls-sub" />
        <StepChoices v-if="classFeatureChoices.length" scope="class" class="cls-sub" />
        <StepSpells v-if="isCaster" class="cls-sub" />
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import RichContent from '@/shared/ui/RichContent'
import SelectTile from '@/features/character-list/components/wizard/SelectTile.vue'
import StepChoices from '@/features/character-list/components/wizard/steps/StepChoices.vue'
import StepClassEquipment from '@/features/character-list/components/wizard/steps/StepClassEquipment.vue'
import StepSkills from '@/features/character-list/components/wizard/steps/StepSkills.vue'
import StepSpells from '@/features/character-list/components/wizard/steps/StepSpells.vue'
import { classSummary, monogramOf } from '@/features/character-list/components/wizard/labels'

const {
  classes, subclasses, state, loading, suggestValue, subclassAtCreation,
  skillOptions, classFeatureChoices, isCaster,
} = inject('createWizard')
const classDesc = computed(() => state.charClass?.data?.description || '')
const subclassDesc = computed(() => state.subclass?.data?.description || '')
const classDetails = ref(null)
let scrollPending = false

function selectClass(charClass) {
  if (state.charClass?.id === charClass.id) return
  scrollPending = true
  state.charClass = charClass
}
function afterClassDetailsEnter() {
  if (!scrollPending) return
  scrollPending = false
  requestAnimationFrame(() => classDetails.value?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  }))
}
</script>

<style scoped>
.step { display: flex; flex-direction: column; gap: 12px; }
.selection-details { display: flex; flex-direction: column; gap: 12px; scroll-margin-top: 12px; }
.step-gap { margin-top: 8px; }
.step-note { font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--text-muted); }
.step-muted { font-size: 13px; color: var(--text-muted); margin: 0; }
.step-desc {
  font-size: 13px; color: var(--text-2); line-height: 1.5;
  background: var(--surface); border-radius: var(--r-md);
  border-left: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  padding: 11px 14px;
}
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
.cls-sub { margin-top: 8px; padding-top: 14px; border-top: 1px solid var(--border); }

.choice-panel-enter-active,
.choice-panel-leave-active { transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.14s ease; }
.choice-panel-enter-from { opacity: 0; transform: translateX(16px); }
.choice-panel-leave-to { opacity: 0; transform: translateX(-12px); }

@media (prefers-reduced-motion: reduce) {
  .choice-panel-enter-active, .choice-panel-leave-active { transition: none; }
}
</style>
