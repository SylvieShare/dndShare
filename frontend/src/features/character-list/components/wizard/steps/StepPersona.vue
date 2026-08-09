<template>
  <div class="step">
    <div class="sheet-section-title">Личность <span class="opt">— необязательно</span></div>
    <p class="hint">Опиши характер персонажа. Всё это можно заполнить и позже — на вкладке «Личность» листа.</p>

    <label class="fld">
      <span class="lbl">Мировоззрение</span>
      <select v-model="p.alignment" class="inp">
        <option value="">—</option>
        <option v-for="a in ALIGNMENTS" :key="a" :value="a">{{ a }}</option>
      </select>
    </label>

    <div class="two rich-fields">
      <InputDescription
        v-for="field in personalityFields"
        :key="field.id"
        class="rich-field"
        :block="field"
        :value="p[field.key]"
        editable
        @update:value="(_id, value) => p[field.key] = value"
      />
    </div>

    <InputDescription
      v-for="field in storyFields"
      :key="field.id"
      class="rich-field"
      :block="field"
      :value="p[field.key]"
      editable
      @update:value="(_id, value) => p[field.key] = value"
    />

    <div class="phys">
      <label class="fld sm"><span class="lbl">Возраст</span><input v-model="p.age" class="inp" type="text" /></label>
      <label class="fld sm"><span class="lbl">Рост</span><input v-model="p.height" class="inp" type="text" /></label>
      <label class="fld sm"><span class="lbl">Вес</span><input v-model="p.weight" class="inp" type="text" /></label>
      <label class="fld sm"><span class="lbl">Глаза</span><input v-model="p.eyes" class="inp" type="text" /></label>
      <label class="fld sm"><span class="lbl">Волосы</span><input v-model="p.hair" class="inp" type="text" /></label>
      <label class="fld sm"><span class="lbl">Кожа</span><input v-model="p.skin" class="inp" type="text" /></label>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import InputDescription from '@/shared/ui/InputDescription'

const { state } = inject('createWizard')
const p = state.persona

const ALIGNMENTS = [
  'Законно-добрый', 'Нейтрально-добрый', 'Хаотично-добрый',
  'Законно-нейтральный', 'Нейтральный', 'Хаотично-нейтральный',
  'Законно-злой', 'Нейтрально-злой', 'Хаотично-злой',
]

const personalityFields = [
  { id: 'person_traits', key: 'traits', title: 'Черты характера', content: { placeholder: 'Как ведёт себя персонаж' } },
  { id: 'person_ideals', key: 'ideals', title: 'Идеалы', content: { placeholder: 'Во что верит' } },
  { id: 'person_bonds', key: 'bonds', title: 'Привязанности', content: { placeholder: 'Что дорого' } },
  { id: 'person_flaws', key: 'flaws', title: 'Слабости', content: { placeholder: 'Пороки и уязвимости' } },
]

const storyFields = [
  { id: 'person_appearance', key: 'appearance', title: 'Внешность', content: { placeholder: 'Как выглядит персонаж' } },
  { id: 'person_backstory', key: 'backstory', title: 'Предыстория персонажа', content: { placeholder: 'Расскажи историю персонажа' } },
  { id: 'person_allies', key: 'allies', title: 'Союзники и организации', content: { placeholder: 'Союзники, организации, контакты' } },
]
</script>

<style scoped>
.step { display: flex; flex-direction: column; gap: 12px; }
.opt { font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--text-muted); }
.hint { font-size: 12px; color: var(--text-muted); margin: 0; }
.two { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.rich-fields { align-items: start; }
.rich-field { min-width: 0; }
.rich-field :deep(.desc-title) { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-muted); font-weight: 650; }
.phys { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
.fld { display: flex; flex-direction: column; gap: 5px; }
.lbl { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-muted); font-weight: 650; }
.inp {
  background: var(--surface-raised); border: 1px solid var(--border-strong); border-radius: 8px;
  color: var(--text-1); font: inherit; font-size: 13px; padding: 8px 10px; outline: none; box-sizing: border-box; width: 100%;
}
.inp:focus { border-color: var(--accent); }
</style>
