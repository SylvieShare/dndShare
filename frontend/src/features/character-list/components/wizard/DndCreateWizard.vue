<template>
  <div class="wz">
    <div class="wz-steps">
      <span
        v-for="(s, i) in steps"
        :key="s.key"
        class="wz-pip"
        :class="{ active: i === state.step, done: i < state.step }"
      >{{ s.title }}</span>
    </div>

    <div class="wz-body">
      <!-- Identity -->
      <section v-if="stepKey === 'identity'" class="wz-sec">
        <FormField label="Имя персонажа" vertical>
          <FormTextInput v-model:value="state.name" placeholder="Введите имя..." />
        </FormField>

        <FormField label="Раса" vertical>
          <select class="wz-select" :value="state.race?.id ?? ''" @change="pickRace($event.target.value)">
            <option value="">Выберите расу</option>
            <option v-for="r in races" :key="r.id" :value="r.id">{{ r.name }}</option>
          </select>
        </FormField>
        <FormField v-if="subraces.length" label="Подраса" vertical>
          <select class="wz-select" :value="state.subrace?.id ?? ''" @change="pickSub('subrace', subraces, $event.target.value)">
            <option value="">— без подрасы —</option>
            <option v-for="r in subraces" :key="r.id" :value="r.id">{{ r.name }}</option>
          </select>
        </FormField>

        <FormField label="Класс" vertical>
          <select class="wz-select" :value="state.charClass?.id ?? ''" @change="pickClass($event.target.value)">
            <option value="">Выберите класс</option>
            <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </FormField>
        <FormField v-if="subclasses.length && subclassAtCreation" label="Архетип" vertical>
          <select class="wz-select" :value="state.subclass?.id ?? ''" @change="pickSub('subclass', subclasses, $event.target.value)">
            <option value="">— без архетипа —</option>
            <option v-for="c in subclasses" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </FormField>

        <p v-if="loading" class="wz-muted">Загрузка справочника…</p>
        <p v-else-if="!races.length && !classes.length" class="wz-muted">В справочнике пока нет рас и классов. Их нужно завести (Фаза наполнения).</p>
      </section>

      <!-- Stats -->
      <section v-else-if="stepKey === 'stats'" class="wz-sec">
        <DndStatAssign
          :state="state"
          :stats="STATS"
          :final-scores="finalScores"
          :grants-asi="grants.asi"
          :points-left="pointsLeft"
          @method="setMethod"
          @roll="rollStats"
        />
      </section>

      <!-- Skills -->
      <section v-else-if="stepKey === 'choices'" class="wz-sec">
        <div class="wz-sec-title">Владение навыками <span v-if="skillLimit" class="wz-count">{{ state.skillIds.length }} / {{ skillLimit }}</span></div>
        <p v-if="!skillOptions.length" class="wz-muted">Класс не предлагает выбор навыков (или не заполнен).</p>
        <label v-for="opt in skillOptions" :key="opt.id" class="wz-check">
          <input
            type="checkbox"
            :checked="state.skillIds.includes(opt.id)"
            :disabled="!state.skillIds.includes(opt.id) && state.skillIds.length >= skillLimit"
            @change="toggleSkill(opt.id)"
          />
          <span>{{ opt.name }}</span>
        </label>
      </section>

      <!-- Feature choices -->
      <section v-else-if="stepKey === 'features'" class="wz-sec">
        <template v-for="fc in featureChoices" :key="fc.id">
          <div class="wz-sec-title">{{ fc.name }} <span class="wz-count">{{ choiceSelected(fc.id).length }} / {{ fc.choice.count || 1 }}</span></div>
          <p v-if="fc.choice.text" class="wz-muted">{{ fc.choice.text }}</p>
          <label v-for="opt in choiceOptionList(fc)" :key="opt.value" class="wz-check">
            <input
              :type="(fc.choice.count || 1) === 1 ? 'radio' : 'checkbox'"
              :name="'fc-' + fc.id"
              :checked="choiceSelected(fc.id).some(v => String(v) === String(opt.value))"
              :disabled="(fc.choice.count || 1) > 1 && !choiceSelected(fc.id).some(v => String(v) === String(opt.value)) && choiceSelected(fc.id).length >= (fc.choice.count || 1)"
              @change="toggleChoice(fc.id, opt.value, fc.choice.count || 1)"
            />
            <span>{{ opt.label }}<small v-if="opt.desc" class="wz-muted"> — {{ opt.desc }}</small></span>
          </label>
        </template>
      </section>

      <!-- Spells -->
      <section v-else-if="stepKey === 'spells'" class="wz-sec">
        <div class="wz-sec-title">Заклинания <span class="wz-count">{{ state.spellIds.length }}</span></div>
        <p v-if="grants.spellcasting?.note" class="wz-muted" v-html="grants.spellcasting.note"></p>
        <p v-if="!spellPool.length" class="wz-muted">Доступных заклинаний для класса не найдено (нужно наполнение + миграция classes).</p>
        <label v-for="sp in spellPool" :key="sp.id" class="wz-check">
          <input type="checkbox" :checked="state.spellIds.includes(sp.id)" @change="toggleSpell(sp.id)" />
          <span>{{ sp.name }} <small class="wz-muted">· {{ sp.data?.lvl ? `${sp.data.lvl} ур.` : 'заговор' }}</small></span>
        </label>
      </section>

      <!-- Review -->
      <section v-else-if="stepKey === 'review'" class="wz-sec">
        <div class="wz-review">
          <div><b>{{ state.name || 'Без имени' }}</b></div>
          <div class="wz-muted">{{ [state.race?.name, state.subrace?.name].filter(Boolean).join(' · ') }} · {{ [state.charClass?.name, state.subclass?.name].filter(Boolean).join(' · ') }}</div>
          <div class="wz-scores">
            <span v-for="s in STATS" :key="s">{{ s }} {{ finalScores[s] }}</span>
          </div>
        </div>
      </section>
    </div>

    <!-- Grants preview (shown on identity/review) -->
    <div v-if="showGrants" class="wz-grants">
      <div class="wz-grants-title">Вы получите</div>
      <ul class="wz-grants-list">
        <li v-if="grants.speed != null">Скорость: {{ grants.speed }} фт.</li>
        <li v-if="grants.size">Размер: {{ grants.size }}</li>
        <li v-if="grants.hitDieId">Кость хитов: {{ dieLabel(grants.hitDieId) || '—' }}</li>
        <li v-if="grants.saves.length">Спасброски: {{ grants.saves.join(', ') }}</li>
        <li v-if="grants.asi.length">Характеристики: {{ grants.asi.map(a => `${a.stat} +${a.bonus}`).join(', ') }}</li>
        <li v-if="profList.length">Владения: {{ profList.join(', ') }}</li>
        <li v-if="langList.length">Языки: {{ langList.join(', ') }}</li>
        <li v-if="featureNames.length">Способности: {{ featureNames.join(', ') }}</li>
      </ul>
    </div>

    <div class="wz-nav">
      <button class="wz-btn ghost" @click="back">{{ state.step === 0 ? 'Отмена' : 'Назад' }}</button>
      <button v-if="!isLast" class="wz-btn" :disabled="!canNext" @click="next">Далее</button>
      <button v-else class="wz-btn" :disabled="creating || !canNext" @click="submit">{{ creating ? 'Создание…' : 'Создать' }}</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import DndStatAssign from './DndStatAssign.vue'
import FormField from '@/shared/ui/form/FormField'
import FormTextInput from '@/shared/ui/form/FormTextInput'
import { featuresForBinding } from '@/features/character-editor/settings/dnd/creation/progression'
import { useDndCreateWizard } from '@/features/character-list/composables/useDndCreateWizard'
import { dieLabel } from '@/shared/lib/systemDice'

const props = defineProps({
  templateId: { type: [Number, String], required: true },
  creating: { type: Boolean, default: false },
})
const emit = defineEmits(['create', 'cancel'])

const wz = useDndCreateWizard()
const {
  STATS, state, races, classes, subraces, subclasses, spellPool, loading,
  raceAbilities, classAbilities,
  grants, isCaster, skillOptions, skillLimit, finalScores, pointsLeft,
  featureChoices, choiceOptionList, choiceSelected, toggleChoice, choicesComplete,
  suggestValue, load, loadSpells, setMethod, rollStats, scoresComplete, buildPayload,
} = wz

onMounted(load)

const steps = computed(() => {
  const s = [
    { key: 'identity', title: 'Личность' },
    { key: 'stats', title: 'Статы' },
    { key: 'choices', title: 'Навыки' },
  ]
  if (featureChoices.value.length) s.push({ key: 'features', title: 'Выборы' })
  if (isCaster.value) s.push({ key: 'spells', title: 'Магия' })
  s.push({ key: 'review', title: 'Обзор' })
  return s
})
const stepKey = computed(() => steps.value[state.step]?.key)
const isLast = computed(() => state.step >= steps.value.length - 1)
const showGrants = computed(() => (stepKey.value === 'identity' || stepKey.value === 'review') && (state.race || state.charClass))
// Subclass is chosen at creation only when the class picks its archetype at level 1.
const subclassAtCreation = computed(() => (Number(state.charClass?.data?.subclass_level) || 99) <= 1)
const requiresSubclass = computed(() => subclassAtCreation.value && subclasses.value.length > 0)

const profList = computed(() => {
  const p = grants.value.proficiencies
  return [
    ...p.armor.map((id) => suggestValue(3, id)),
    ...p.weapon.map((id) => suggestValue(4, id)),
    ...p.tool.map((id) => suggestValue(5, id)),
  ].filter(Boolean)
})
const langList = computed(() => grants.value.languages.map((id) => suggestValue(6, id)).filter(Boolean))

const featureNames = computed(() => {
  const race = featuresForBinding(raceAbilities.value, { raceId: state.race?.id, subraceId: state.subrace?.id }, 1)
  const cls = featuresForBinding(classAbilities.value, { classId: state.charClass?.id, subclassId: state.subclass?.id }, 1)
  return [...race, ...cls].map((i) => i.name).filter(Boolean)
})

const canNext = computed(() => {
  switch (stepKey.value) {
    case 'identity': return !!(state.name.trim() && state.race && state.charClass) && (!requiresSubclass.value || !!state.subclass)
    case 'stats': return scoresComplete.value && pointsLeft.value >= 0
    case 'choices': return skillLimit.value === 0 || state.skillIds.length === skillLimit.value
    case 'features': return choicesComplete.value
    default: return true
  }
})

function pickRace(id) { state.race = races.value.find((r) => String(r.id) === String(id)) || null }
function pickClass(id) { state.charClass = classes.value.find((c) => String(c.id) === String(id)) || null }
function pickSub(key, list, id) { state[key] = list.value ? list.value.find((x) => String(x.id) === String(id)) || null : list.find((x) => String(x.id) === String(id)) || null }

function toggleSkill(id) {
  const i = state.skillIds.indexOf(id)
  if (i >= 0) state.skillIds.splice(i, 1)
  else if (state.skillIds.length < skillLimit.value) state.skillIds.push(id)
}
function toggleSpell(id) {
  const i = state.spellIds.indexOf(id)
  if (i >= 0) state.spellIds.splice(i, 1)
  else state.spellIds.push(id)
}

async function next() {
  if (!canNext.value) return
  const goingTo = steps.value[state.step + 1]?.key
  if (goingTo === 'spells') await loadSpells()
  state.step++
}
function back() {
  if (state.step === 0) { emit('cancel'); return }
  state.step--
}
function submit() {
  if (props.creating) return
  emit('create', { templateId: props.templateId, ...buildPayload() })
}
</script>

<style scoped>
.wz { display: flex; flex-direction: column; gap: 14px; }
.wz-steps { display: flex; flex-wrap: wrap; gap: 6px; }
.wz-pip {
  font-size: 11px; padding: 3px 9px; border-radius: 999px;
  background: var(--surface-raised); color: var(--text-muted); border: 1px solid var(--border-strong);
}
.wz-pip.active { background: var(--accent); color: var(--text-on-accent); border-color: var(--accent); }
.wz-pip.done { color: var(--text-2); }
.wz-body { min-height: 180px; }
.wz-sec { display: flex; flex-direction: column; gap: 12px; }
.wz-sec-title { font-weight: 700; color: var(--text-1); display: flex; align-items: center; gap: 8px; }
.wz-count { font-size: 12px; color: var(--text-muted); font-weight: 600; }
.wz-select {
  width: 100%; background: var(--surface-raised); border: 1px solid var(--border-strong); border-radius: 8px;
  color: var(--text-1); font: inherit; padding: 9px 12px; outline: none;
}
.wz-select:focus { border-color: var(--accent); }
.wz-check { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-1); cursor: pointer; }
.wz-muted { font-size: 12px; color: var(--text-muted); margin: 0; }
.wz-review { display: flex; flex-direction: column; gap: 6px; }
.wz-scores { display: flex; flex-wrap: wrap; gap: 10px; font-weight: 600; color: var(--text-2); margin-top: 6px; }
.wz-grants { background: var(--surface-raised); border: 1px solid var(--border-strong); border-radius: 10px; padding: 12px 14px; }
.wz-grants-title { font-size: 12px; font-weight: 700; color: var(--accent); margin-bottom: 6px; }
.wz-grants-list { margin: 0; padding-left: 18px; font-size: 12px; color: var(--text-muted); display: flex; flex-direction: column; gap: 3px; }
.wz-nav { display: flex; justify-content: space-between; gap: 10px; padding-top: 4px; }
.wz-btn {
  background: var(--accent); color: var(--text-on-accent); border: none; border-radius: 8px;
  padding: 9px 20px; font: inherit; font-weight: 600; cursor: pointer;
}
.wz-btn:disabled { opacity: 0.5; cursor: default; }
.wz-btn.ghost { background: transparent; color: var(--text-muted); border: 1px solid var(--border-strong); }
</style>
