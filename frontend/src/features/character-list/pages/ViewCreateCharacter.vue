<template>
  <div class="cc">
    <header class="cc-head">
      <button class="cc-x" title="Закрыть" @click="exit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      <div class="cc-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5" /></svg>
        Создание персонажа
      </div>
      <span class="cc-progress">Шаг {{ current + 1 }} из {{ steps.length }}</span>
    </header>

    <div class="cc-body">
      <CreateStepRail class="cc-rail" :steps="steps" :current="current" @go="goTo" />

      <main class="cc-main">
        <transition name="cc-fade" mode="out-in">
          <component :is="stepComponent" :key="stepKey" />
        </transition>
      </main>

      <CreatePreview class="cc-preview" />
    </div>

    <footer class="cc-foot">
      <button class="btn ghost" @click="back">{{ current === 0 ? 'Отмена' : 'Назад' }}</button>
      <span v-if="blockReason && !isLast" class="cc-reason">{{ blockReason }}</span>
      <div class="cc-actions">
        <button v-if="!isLast" class="btn soft" :disabled="creating" @click="createNow">Создать</button>
        <button v-if="!isLast" class="btn next" :disabled="!canNext" @click="next">Далее</button>
        <button v-else class="btn create" :disabled="creating" @click="createNow">{{ creating ? 'Создание…' : 'Создать персонажа' }}</button>
      </div>
    </footer>

    <ConfirmDialog
      v-if="confirmOpen"
      title="Создать персонажа?"
      message="Часть полей не заполнена — их можно дозаполнить позже на листе. Создать как есть?"
      confirm-label="Создать"
      @cancel="confirmOpen = false"
      @confirm="submit"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, provide, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import CreatePreview from '@/features/character-list/components/wizard/CreatePreview.vue'
import CreateStepRail from '@/features/character-list/components/wizard/CreateStepRail.vue'
import StepChoices from '@/features/character-list/components/wizard/steps/StepChoices.vue'
import StepClass from '@/features/character-list/components/wizard/steps/StepClass.vue'
import StepRace from '@/features/character-list/components/wizard/steps/StepRace.vue'
import StepReview from '@/features/character-list/components/wizard/steps/StepReview.vue'
import StepSkills from '@/features/character-list/components/wizard/steps/StepSkills.vue'
import StepSpells from '@/features/character-list/components/wizard/steps/StepSpells.vue'
import StepStats from '@/features/character-list/components/wizard/steps/StepStats.vue'
import StepVersion from '@/features/character-list/components/wizard/steps/StepVersion.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog'
import { fetchPost } from '@/shared/api/http'
import { resolveSetting } from '@/features/character-editor/settings'
import { useAccountStore } from '@/stores/account'
import { useDndCreateWizard } from '@/features/character-list/composables/useDndCreateWizard'
import { useTemplateStore } from '@/stores/template'

const router = useRouter()
const templateStore = useTemplateStore()
const wz = useDndCreateWizard()
provide('createWizard', wz)

const {
  state, load, loadSpells, buildPayload, restore, clearPersist,
  isCaster, featureChoices, requiresSubrace, requiresSubclass,
  scoresComplete, pointsLeft, skillLimit, choicesComplete, spellsComplete,
  asiChoiceComplete, raceVariantsComplete,
} = wz

const confirmOpen = ref(false)
const isComplete = computed(() =>
  state.version === '2014' && !!state.race && !!state.charClass && !!state.name.trim() && scoresComplete.value)

const STEP_COMPONENTS = {
  version: StepVersion, race: StepRace, class: StepClass, stats: StepStats, skills: StepSkills,
  features: StepChoices, spells: StepSpells, review: StepReview,
}

const creating = ref(false)
const dndTemplateId = ref(null)

const steps = computed(() => {
  const s = [
    { key: 'version', title: 'Версия' },
    { key: 'race', title: 'Раса' },
    { key: 'class', title: 'Класс' },
    { key: 'stats', title: 'Характеристики' },
    { key: 'skills', title: 'Навыки' },
  ]
  if (featureChoices.value.length) s.push({ key: 'features', title: 'Выборы' })
  if (isCaster.value) s.push({ key: 'spells', title: 'Магия' })
  s.push({ key: 'review', title: 'Обзор' })
  return s
})
const current = computed(() => state.step)
const stepKey = computed(() => steps.value[current.value]?.key)
const stepComponent = computed(() => STEP_COMPONENTS[stepKey.value])
const isLast = computed(() => current.value >= steps.value.length - 1)

// The step list is dynamic (Выборы/Магия appear/disappear) — keep the index valid.
watch(() => steps.value.length, (len) => { if (state.step > len - 1) state.step = len - 1 })

const validation = computed(() => {
  switch (stepKey.value) {
    case 'version':
      return state.version === '2014' ? { ok: true } : { ok: false, reason: '2024 в разработке — выбери 2014' }
    case 'race':
      if (!state.race) return { ok: false, reason: 'Выбери расу' }
      if (requiresSubrace.value && !state.subrace) return { ok: false, reason: 'Выбери происхождение' }
      if (!raceVariantsComplete.value) return { ok: false, reason: 'Сделай выбор расы' }
      if (!asiChoiceComplete.value) return { ok: false, reason: 'Распредели расовый бонус' }
      return { ok: true }
    case 'class':
      if (!state.charClass) return { ok: false, reason: 'Выбери класс' }
      if (requiresSubclass.value && !state.subclass) return { ok: false, reason: 'Выбери архетип' }
      return { ok: true }
    case 'stats':
      if (!scoresComplete.value) return { ok: false, reason: 'Заполни все характеристики' }
      if (pointsLeft.value < 0) return { ok: false, reason: 'Превышен бюджет очков' }
      return { ok: true }
    case 'skills':
      if (skillLimit.value && state.skillIds.length !== skillLimit.value) return { ok: false, reason: `Навыки: ${state.skillIds.length} из ${skillLimit.value}` }
      return { ok: true }
    case 'features':
      if (!choicesComplete.value) return { ok: false, reason: 'Сделай все выборы' }
      return { ok: true }
    case 'spells':
      if (!spellsComplete.value) return { ok: false, reason: 'Слишком много заклинаний' }
      return { ok: true }
    case 'review':
      if (!state.name.trim()) return { ok: false, reason: 'Впиши имя' }
      return { ok: true }
    default:
      return { ok: true }
  }
})
const canNext = computed(() => validation.value.ok)
const blockReason = computed(() => (validation.value.ok ? '' : validation.value.reason))

async function next() {
  if (!canNext.value) return
  if (steps.value[current.value + 1]?.key === 'spells') await loadSpells()
  state.step++
}
function back() {
  if (current.value === 0) { exit(); return }
  state.step--
}
function goTo(i) { if (i <= current.value) state.step = i }
function exit() { router.push('/chars') }

// "Создать" is available on every step (an empty character is allowed) — confirm
// first when something's missing, then build with whatever's filled (blanks default).
function createNow() {
  if (creating.value) return
  if (isComplete.value) submit()
  else confirmOpen.value = true
}

async function submit() {
  confirmOpen.value = false
  if (creating.value || !dndTemplateId.value) return
  creating.value = true
  try {
    const res = await fetchPost('/chars', { templateId: dndTemplateId.value, ...buildPayload() })
    if (res?.uuid) { clearPersist(); router.push('/char/' + res.uuid) }
  } finally {
    creating.value = false
  }
}

onMounted(async () => {
  useAccountStore().ensureAuth()
  load()
  restore()
  await templateStore.ensure()
  dndTemplateId.value = templateStore.all.find((t) => resolveSetting(t)?.system === 'dnd5e')?.id ?? null
})
</script>

<style scoped>
.cc {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--header-h));
  max-width: 1180px;
  margin: 0 auto;
  box-sizing: border-box;
}

.cc-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 24px 12px;
}
.cc-x {
  width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
  background: none; border: none; color: var(--text-muted); cursor: pointer; border-radius: 8px;
}
.cc-x:hover { background: color-mix(in srgb, #fff 5%, transparent); color: var(--text-1); }
.cc-x svg { width: 18px; height: 18px; }
.cc-title { display: flex; align-items: center; gap: 9px; font-family: var(--font-display); font-size: 23px; font-weight: 600; color: var(--warning); }
.cc-title svg { width: 20px; height: 20px; color: var(--accent); }
.cc-progress { margin-left: auto; font-size: 12px; color: var(--text-muted); }

.cc-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 184px minmax(0, 1fr) 240px;
  gap: 20px;
  padding: 4px 24px 16px;
}
.cc-rail { position: sticky; top: 0; align-self: start; }
.cc-main { min-width: 0; overflow-y: auto; padding: 4px 2px; }
.cc-preview { overflow-y: auto; }

.cc-fade-enter-active, .cc-fade-leave-active { transition: opacity 0.16s ease; }
.cc-fade-enter-from, .cc-fade-leave-to { opacity: 0; }

.cc-foot {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 24px;
  border-top: 1px solid var(--border);
}
.cc-reason { font-size: 12px; color: var(--text-muted); }
.cc-actions { margin-left: auto; display: flex; gap: 10px; }
.btn { border: none; border-radius: 9px; padding: 10px 22px; font: inherit; font-weight: 600; cursor: pointer; }
.btn.ghost { background: transparent; color: var(--text-2); box-shadow: inset 0 0 0 1px var(--border-strong); }
.btn.ghost:hover { color: var(--text-1); }
.btn.soft { background: var(--surface-1); color: var(--text-1); }
.btn.soft:hover:not(:disabled) { background: var(--surface-2); }
.btn.next { background: var(--accent); color: #fff; }
.btn.next:hover:not(:disabled) { background: var(--accent-dim); }
.btn.create { background: var(--accent-2); color: #06231d; }
.btn.create:hover:not(:disabled) { background: var(--accent-2-dim); }
.btn:disabled { opacity: 0.5; cursor: default; }

@media (max-width: 920px) {
  .cc-body { grid-template-columns: minmax(0, 1fr); }
  .cc-rail, .cc-preview { display: none; }
  .cc { height: auto; min-height: calc(100vh - var(--header-h)); }
}
</style>
