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
        @select="state.charClass = c"
      />
    </div>

    <template v-if="state.charClass && subclasses.length">
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
    </template>

    <template v-if="state.charClass">
      <StepSkills v-if="skillOptions.length" class="cls-sub" />
      <StepChoices v-if="classFeatureChoices.length" scope="class" class="cls-sub" />
      <StepSpells v-if="isCaster" class="cls-sub" />
    </template>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import SelectTile from '@/features/character-list/components/wizard/SelectTile.vue'
import StepChoices from '@/features/character-list/components/wizard/steps/StepChoices.vue'
import StepSkills from '@/features/character-list/components/wizard/steps/StepSkills.vue'
import StepSpells from '@/features/character-list/components/wizard/steps/StepSpells.vue'
import { classSummary, monogramOf } from '@/features/character-list/components/wizard/labels'

const {
  classes, subclasses, state, loading, suggestValue, subclassAtCreation,
  skillOptions, classFeatureChoices, isCaster,
} = inject('createWizard')
</script>

<style scoped>
.step { display: flex; flex-direction: column; gap: 12px; }
.step-gap { margin-top: 8px; }
.step-note { font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--text-muted); }
.step-muted { font-size: 13px; color: var(--text-muted); margin: 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
.cls-sub { margin-top: 8px; padding-top: 14px; border-top: 1px solid var(--border); }
</style>
