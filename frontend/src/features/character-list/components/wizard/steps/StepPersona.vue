<template>
  <div class="step">
    <header class="step-heading">
      <span class="heading-icon"><Fingerprint :size="22" aria-hidden="true" /></span>
      <div>
        <div class="sheet-section-title">Личность <span class="opt">— необязательно, кроме имени</span></div>
        <p class="hint">Собери образ героя: как он выглядит, во что верит и какую историю несёт с собой.</p>
      </div>
    </header>

    <section class="identity-card">
      <PersonaMediaPicker
        :portrait="p.portrait"
        :icon="p.icon"
        @update:portrait="p.portrait = $event"
        @update:icon="p.icon = $event"
      />

      <div class="identity-fields">
        <div class="identity-eyebrow">
          <Sparkles :size="14" aria-hidden="true" />
          Главный образ
        </div>
        <FormField label="Имя персонажа" vertical>
          <div class="name-field">
            <FormTextInput v-model:value="state.name" placeholder="Как зовут героя?" />
            <button type="button" class="name-dice" title="Предложить случайное имя" aria-label="Предложить случайное имя" @click="randomName">
              <Dices :size="19" aria-hidden="true" />
            </button>
          </div>
        </FormField>

        <FormField label="Мировоззрение" vertical>
          <DndAlignmentPicker v-model="p.alignment" />
        </FormField>

        <div class="identity-summary">
          <span><UserRound :size="14" aria-hidden="true" />{{ raceLabel }}</span>
          <span><Shield :size="14" aria-hidden="true" />{{ classLabel }}</span>
        </div>
      </div>
    </section>

    <section class="persona-section">
      <div class="section-heading">
        <span class="section-icon"><HeartHandshake :size="18" aria-hidden="true" /></span>
        <div><h3>Характер</h3><p>То, что направляет решения и связывает героя с миром.</p></div>
      </div>
      <div class="two rich-fields personality-fields">
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
    </section>

    <section class="persona-section">
      <div class="section-heading">
        <span class="section-icon"><BookOpenText :size="18" aria-hidden="true" /></span>
        <div><h3>История</h3><p>Внешность, прошлое и люди, которые всё ещё имеют значение.</p></div>
      </div>
      <div class="story-grid">
        <InputDescription
          v-for="field in storyFields"
          :key="field.id"
          class="rich-field story-field"
          :class="`story-field--${field.key}`"
          :block="field"
          :value="p[field.key]"
          editable
          @update:value="(_id, value) => p[field.key] = value"
        />
      </div>
    </section>

    <section class="persona-section">
      <div class="section-heading">
        <span class="section-icon"><ScanFace :size="18" aria-hidden="true" /></span>
        <div><h3>Облик</h3><p>Короткие ориентиры для листа и отыгрыша.</p></div>
      </div>
      <div class="phys">
        <FormField v-for="field in appearanceFields" :key="field.key" :label="field.label" vertical>
          <FormTextInput v-model:value="p[field.key]" />
          <small v-if="appearanceHint(field.key)" class="appearance-hint">{{ appearanceHint(field.key) }}</small>
        </FormField>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { BookOpenText, Dices, Fingerprint, HeartHandshake, ScanFace, Shield, Sparkles, UserRound } from '@lucide/vue'
import InputDescription from '@/shared/ui/InputDescription'
import DndAlignmentPicker from '@/shared/ui/DndAlignmentPicker.vue'
import PersonaMediaPicker from '@/features/character-list/components/wizard/PersonaMediaPicker.vue'
import { FormField, FormTextInput } from '@sylvieshare/share-ui'

const { state, randomName } = inject('createWizard')
const p = state.persona
const raceLabel = computed(() => [state.race?.name, state.subrace?.name].filter(Boolean).join(' · ') || 'Раса не выбрана')
const classLabel = computed(() => [state.charClass?.name, state.subclass?.name].filter(Boolean).join(' · ') || 'Класс не выбран')

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
  { id: 'person_backstory', key: 'backstory', title: 'Предыстория персонажа', content: { placeholder: 'Расскажи историю персонажа' } },
  { id: 'person_appearance', key: 'appearance', title: 'Внешность', content: { placeholder: 'Как выглядит персонаж' } },
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
.step { display: flex; flex-direction: column; gap: 16px; }
.step-heading { display: flex; align-items: flex-start; gap: 11px; }
.heading-icon, .section-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, var(--surface-raised));
  border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border));
}
.heading-icon { width: 38px; height: 38px; border-radius: 12px; }
.opt { font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--text-muted); }
.hint { font-size: 12px; line-height: 1.45; color: var(--text-muted); margin: 4px 0 0; }
.identity-card {
  display: grid;
  grid-template-columns: minmax(360px, .95fr) minmax(300px, 1.05fr);
  gap: 22px;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent) 7%, transparent), transparent 42%),
    var(--surface);
  box-shadow: 0 12px 34px color-mix(in srgb, var(--scrim) 8%, transparent);
}
.identity-fields { display: flex; flex-direction: column; justify-content: center; gap: 14px; min-width: 0; }
.identity-eyebrow { display: flex; align-items: center; gap: 6px; color: var(--accent); font-size: 10px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
.identity-summary { display: flex; flex-wrap: wrap; gap: 7px; }
.identity-summary span { display: inline-flex; align-items: center; gap: 6px; min-width: 0; padding: 6px 9px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface-raised); color: var(--text-2); font-size: 11px; }
.persona-section { padding: 17px; border: 1px solid var(--border); border-radius: 18px; background: color-mix(in srgb, var(--surface-raised) 62%, var(--surface)); }
.section-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 13px; }
.section-icon { width: 34px; height: 34px; border-radius: 11px; }
.section-heading h3 { margin: 0; color: var(--text); font-size: 14px; }
.section-heading p { margin: 2px 0 0; color: var(--text-muted); font-size: 10px; line-height: 1.35; }
.two { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.rich-fields { align-items: start; }
.rich-field { min-width: 0; }
.rich-field:has(.desc-title) :deep(.editable-div) { min-height: 88px; }
.personality-fields .rich-field:nth-of-type(2) :deep(.editable-div) { min-height: 88px; }
.rich-field :deep(.desc-title) { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-muted); font-weight: 650; }
.story-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; align-items: start; }
.story-field--backstory { grid-row: span 2; }
.story-field--backstory :deep(.editable-div) { min-height: 224px; }
.phys { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; align-items: start; }
.name-field { display: grid; grid-template-columns: minmax(0, 1fr) 38px; gap: 8px; }
.name-dice { display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--border-strong); border-radius: 9px; background: var(--surface-raised); color: var(--accent); cursor: pointer; }
.name-dice:hover { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--surface-raised)); }
.appearance-hint { display: block; margin-top: 4px; color: var(--text-muted); font-size: 10px; line-height: 1.35; }

@media (max-width: 900px) {
  .identity-card { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 640px) {
  .identity-card, .persona-section { padding: 13px; border-radius: 15px; }
  .story-grid { grid-template-columns: 1fr; }
  .story-field--backstory { grid-row: auto; }
  .story-field--backstory :deep(.editable-div) { min-height: 150px; }
  .phys { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
