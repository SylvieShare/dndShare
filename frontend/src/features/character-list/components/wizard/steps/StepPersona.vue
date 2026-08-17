<template>
  <div class="step">
    <div class="sheet-section-title">Личность <span class="opt">— необязательно</span></div>
    <p class="hint">Опиши характер персонажа. Всё это можно заполнить и позже — на вкладке «Личность» листа.</p>

    <FormField label="Имя персонажа" vertical>
      <div class="name-field">
        <FormTextInput v-model:value="state.name" placeholder="Как зовут героя?" />
        <button type="button" class="name-dice" title="Предложить случайное имя" @click="randomName">🎲</button>
      </div>
    </FormField>

    <FormField label="Мировоззрение" vertical>
      <FormSelect v-model:value="p.alignment">
        <option value="">—</option>
        <option v-for="a in ALIGNMENTS" :key="a" :value="a">{{ a }}</option>
      </FormSelect>
    </FormField>

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
      <FormField v-for="field in appearanceFields" :key="field.key" :label="field.label" vertical>
        <FormTextInput v-model:value="p[field.key]" />
        <small v-if="appearanceHint(field.key)" class="appearance-hint">{{ appearanceHint(field.key) }}</small>
      </FormField>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import InputDescription from '@/shared/ui/InputDescription'
import { FormField } from '@sylvieshare/share-ui'
import { FormSelect } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'

const { state, randomName } = inject('createWizard')
const p = state.persona

const ALIGNMENTS = [
  'Законно-добрый', 'Нейтрально-добрый', 'Хаотично-добрый',
  'Законно-нейтральный', 'Нейтральный', 'Хаотично-нейтральный',
  'Законно-злой', 'Нейтрально-злой', 'Хаотично-злой',
]

const appearanceFields = [
  { key: 'age', label: 'Возраст' },
  { key: 'height', label: 'Рост' },
  { key: 'weight', label: 'Вес' },
  { key: 'eyes', label: 'Глаза' },
  { key: 'hair', label: 'Волосы' },
  { key: 'skin', label: 'Кожа' },
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

const RACE_HINTS = [
  [/дварф|дворф/, { age: 'Обычно взрослые с 50 лет, живут около 350 лет', height: 'Обычно 120–150 см', weight: 'Обычно около 70 кг' }],
  [/эльф/, { age: 'Считаются взрослыми примерно со 100 лет, живут до 750 лет', height: 'Обычно 150–185 см', weight: 'Обычно 45–65 кг' }],
  [/полурослик|халфлинг/, { age: 'Взрослые с 20 лет, живут около 150 лет', height: 'Обычно около 90 см', weight: 'Обычно около 18 кг' }],
  [/гном/, { age: 'Взрослые примерно с 40 лет, живут 350–500 лет', height: 'Обычно 90–120 см', weight: 'Обычно около 18 кг' }],
  [/полуэльф/, { age: 'Взрослые примерно с 20 лет, живут более 180 лет', height: 'Обычно 150–185 см', weight: 'Обычно 50–90 кг' }],
  [/полуорк/, { age: 'Взрослые примерно с 14 лет, редко живут дольше 75 лет', height: 'Обычно 150–210 см', weight: 'Обычно 65–115 кг' }],
  [/тифлинг/, { age: 'Взрослеют как люди, живут немного дольше', height: 'Обычно 150–185 см', weight: 'Обычно 55–110 кг' }],
  [/драконорожд/, { age: 'Взрослые примерно с 15 лет, живут около 80 лет', height: 'Обычно выше 180 см', weight: 'Обычно более 110 кг' }],
  [/человек/, { age: 'Взрослые примерно с 18 лет, живут меньше века', height: 'Обычно 150–190 см', weight: 'Обычно 50–120 кг' }],
]
const raceHints = computed(() => {
  const name = String(state.subrace?.name || state.race?.name || '').toLowerCase()
  return RACE_HINTS.find(([pattern]) => pattern.test(name))?.[1] || {}
})
function appearanceHint(key) { return raceHints.value[key] || '' }
</script>

<style scoped>
.step { display: flex; flex-direction: column; gap: 12px; }
.opt { font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--text-muted); }
.hint { font-size: 12px; color: var(--text-muted); margin: 0; }
.two { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.rich-fields { align-items: start; }
.rich-field { min-width: 0; }
.rich-field:has(.desc-title) :deep(.editable-div) { min-height: 76px; }
.rich-field:nth-of-type(2) :deep(.editable-div) { min-height: 150px; }
.rich-field :deep(.desc-title) { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-muted); font-weight: 650; }
.phys { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
.name-field { display: grid; grid-template-columns: minmax(0, 1fr) 38px; gap: 8px; }
.name-dice { border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface-raised); cursor: pointer; }
.appearance-hint { display: block; margin-top: 4px; color: var(--text-muted); font-size: 10px; line-height: 1.35; }
</style>
