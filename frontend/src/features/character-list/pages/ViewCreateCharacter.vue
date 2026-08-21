<template>
  <div class="cc" :class="{ 'cc--embedded': embedded }">
    <header class="cc-head">
      <div class="cc-head-main">
        <button class="cc-x" title="Закрыть" @click="exit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div class="cc-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5" /></svg>
          Создание персонажа
        </div>
        <button class="cc-mobile-reset" title="Начать создание сначала" @click="resetOpen = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></svg>
          <span>Сбросить</span>
        </button>
      </div>
    </header>

    <div class="cc-body">
      <CreateStepRail
        class="cc-rail"
        :steps="steps"
        :current="current"
        :reachable="maxReachable"
        :show-incomplete="!isFullyValid"
        :creating="creating"
        @go="goTo"
        @reset="resetOpen = true"
        @create-incomplete="createIncomplete"
      />

      <main ref="mainRef" class="cc-main" :class="{ 'cc-main--invalid': invalidPulse }">
        <transition name="cc-fade" mode="out-in">
          <component :is="stepComponent" :key="stepKey" />
        </transition>
      </main>
    </div>

    <footer class="cc-foot">
      <div class="cc-foot-main">
        <button class="btn ghost" @click="back">{{ current === 0 ? 'Отмена' : 'Назад' }}</button>
        <button v-if="!isFullyValid" class="btn incomplete-mobile" :disabled="creating" @click="createIncomplete">Создать неполноценного</button>
        <span v-if="error" class="cc-error" role="alert">{{ error }}</span>
        <span v-else-if="blockReason && !isLast" class="cc-reason">{{ blockReason }}</span>
        <div class="cc-actions">
          <button v-if="!isLast" class="btn next" :class="{ disabled: !canNext }" :aria-disabled="!canNext" @click="next">Далее</button>
          <template v-else>
            <button class="btn soft" type="button" :disabled="creating || !dndTemplateId" @click="openPreview">Предпросмотр листа</button>
            <button class="btn create" :disabled="creating" @click="createNow">{{ creating ? 'Создание…' : 'Создать персонажа' }}</button>
          </template>
        </div>
      </div>
    </footer>

    <CharacterSheetModal
      v-if="previewDraft"
      :draft="previewDraft"
      :z-index="3200"
      @close="previewDraft = null"
    />

    <ConfirmDialog
      v-if="confirmOpen"
      title="Создать персонажа?"
      message="Часть полей не заполнена — их можно дозаполнить позже на листе. Создать как есть?"
      confirm-label="Создать"
      @cancel="confirmOpen = false"
      @confirm="submit"
    />

    <ConfirmDialog
      v-if="resetOpen"
      title="Начать сначала?"
      message="Все выборы будут сброшены, и создание начнётся заново."
      confirm-label="Сбросить"
      @cancel="resetOpen = false"
      @confirm="doReset"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, provide, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import CreateStepRail from '@/features/character-list/components/wizard/CreateStepRail.vue'
import StepBackground from '@/features/character-list/components/wizard/steps/StepBackground.vue'
import StepClass from '@/features/character-list/components/wizard/steps/StepClass.vue'
import StepStartingShop from '@/features/character-list/components/wizard/steps/StepStartingShop.vue'
import StepPersona from '@/features/character-list/components/wizard/steps/StepPersona.vue'
import StepRace from '@/features/character-list/components/wizard/steps/StepRace.vue'
import StepStats from '@/features/character-list/components/wizard/steps/StepStats.vue'
import StepVersion from '@/features/character-list/components/wizard/steps/StepVersion.vue'
import CharacterSheetModal from '@/features/character-editor/components/CharacterSheetModal.vue'
import { ConfirmDialog } from '@sylvieshare/share-ui'
import { fetchGet, fetchPost } from '@/shared/api/http'
import { findSourceVersion } from '@/shared/lib/sourceVersions'
import { resolveSetting } from '@/features/character-editor/settings'
import { useAccountStore } from '@/stores/account'
import { useDndCreateWizard } from '@/features/character-list/composables/useDndCreateWizard'
import { useTemplateStore } from '@/stores/template'
import { setCharSeed } from '@/shared/lib/charSeed'

const router = useRouter()
const templateStore = useTemplateStore()
const props = defineProps({
  embedded: { type: Boolean, default: false },
  creating: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
const emit = defineEmits(['cancel', 'create'])
const wz = useDndCreateWizard()
const accountStore = useAccountStore()
provide('createWizard', wz)

const {
  state, load, buildPayload, restore, clearPersist, reset, setSourceVersionId,
  shopSpentCopper, startingWealthCopper, shopSpentLabel, shopRemainingLabel,
  requiresSubrace, requiresSubclass,
  scoresComplete, pointsLeft, skillLimit, spellsComplete,
  cantripLimit, spell1Limit, cantripChosen, spell1Chosen,
  asiChoiceComplete, raceVariantsComplete,
  raceSkillsComplete, raceLangsComplete, featComplete,
  raceChoicesComplete, classChoicesComplete, classEquipmentComplete, bgLangsComplete,
  backgroundItemChoicesComplete,
} = wz

const confirmOpen = ref(false)
const resetOpen = ref(false)
const mainRef = ref(null)
const invalidPulse = ref(false)
function doReset() { resetOpen.value = false; reset() }
const isComplete = computed(() =>
  state.version === '2014' && !!state.race && !!state.charClass && classEquipmentComplete.value
  && (!state.buyStartingEquipment || !!state.startingWealthRoll)
  && !!state.background && backgroundItemChoicesComplete.value
  && !!state.name.trim() && scoresComplete.value)

const STEP_COMPONENTS = {
  version: StepVersion, race: StepRace, class: StepClass, background: StepBackground,
  stats: StepStats, shop: StepStartingShop, persona: StepPersona,
}

const internalCreating = ref(false)
const creating = computed(() => props.creating || internalCreating.value)
const dndTemplateId = ref(null)
const dndSource = ref(null)
const sourceVersionId = computed(() => findSourceVersion(dndSource.value, state.version)?.id ?? null)
watch(sourceVersionId, (id) => setSourceVersionId(id), { immediate: true })

// Race/class choices are made inline on their own steps (skills, feature choices
// and spells are folded into the Class step; race choices into Race). Магазин
// появляется только при замене стартового комплекта начальным богатством.
const statMethodLabel = computed(() => ({
  array: 'Стандартный набор',
  pointbuy: 'Покупка очков',
  roll: 'Бросок кубиков',
})[state.statMethod] || '')
const steps = computed(() => [
  { key: 'version', title: 'Версия', summary: state.version ? `D&D 5e · ${state.version}` : '' },
  { key: 'race', title: 'Раса', summary: [state.race?.name, state.subrace?.name].filter(Boolean).join(' · ') },
  { key: 'class', title: 'Класс', summary: [state.charClass?.name, state.subclass?.name].filter(Boolean).join(' · ') },
  { key: 'background', title: 'Предыстория', summary: state.background?.name || '' },
  { key: 'stats', title: 'Характеристики', summary: statMethodLabel.value },
  ...(state.buyStartingEquipment
    ? [{ key: 'shop', title: 'Магазин', summary: `${shopSpentLabel.value} · остаток ${shopRemainingLabel.value}` }]
    : []),
  { key: 'persona', title: 'Личность', summary: state.name.trim() || state.persona.alignment || '' },
])
const current = computed(() => state.step)
const stepKey = computed(() => steps.value[current.value]?.key)
const stepComponent = computed(() => STEP_COMPONENTS[stepKey.value])
const isLast = computed(() => current.value >= steps.value.length - 1)

// The step list is dynamic (Выборы/Магия appear/disappear) — keep the index valid.
watch(() => steps.value.length, (len) => { if (state.step > len - 1) state.step = len - 1 })

function validateStep(key) {
  switch (key) {
    case 'version':
      return state.version === '2014' ? { ok: true } : { ok: false, reason: '2024 в разработке — выбери 2014' }
    case 'race':
      if (!state.race) return { ok: false, reason: 'Выбери расу' }
      if (requiresSubrace.value && !state.subrace) return { ok: false, reason: 'Выбери происхождение' }
      if (!raceVariantsComplete.value) return { ok: false, reason: 'Сделай выбор расы' }
      if (!asiChoiceComplete.value) return { ok: false, reason: 'Распредели расовый бонус' }
      if (!raceSkillsComplete.value) return { ok: false, reason: 'Выбери расовые навыки' }
      if (!raceLangsComplete.value) return { ok: false, reason: 'Выбери язык' }
      if (!featComplete.value) return { ok: false, reason: 'Выбери черту' }
      if (!raceChoicesComplete.value) return { ok: false, reason: 'Заверши выборы расы' }
      return { ok: true }
    case 'class':
      if (!state.charClass) return { ok: false, reason: 'Выбери класс' }
      if (requiresSubclass.value && !state.subclass) return { ok: false, reason: 'Выбери архетип' }
      if (skillLimit.value && state.skillIds.length !== skillLimit.value) return { ok: false, reason: `Навыки: ${state.skillIds.length} из ${skillLimit.value}` }
      if (!classChoicesComplete.value) return { ok: false, reason: 'Заверши выборы класса' }
      if (cantripLimit.value > 0 && cantripChosen.value !== cantripLimit.value) {
        return { ok: false, reason: `Заговоры: ${cantripChosen.value} из ${cantripLimit.value}` }
      }
      if (spell1Limit.value > 0 && spell1Chosen.value !== spell1Limit.value) {
        return { ok: false, reason: `Заклинания 1 круга: ${spell1Chosen.value} из ${spell1Limit.value}` }
      }
      if (!spellsComplete.value) return { ok: false, reason: 'Проверь выбор заклинаний' }
      if (!classEquipmentComplete.value) return { ok: false, reason: 'Выбери стартовое снаряжение' }
      return { ok: true }
    case 'background':
      if (!state.background) return { ok: false, reason: 'Выбери предысторию' }
      if (!backgroundItemChoicesComplete.value) return { ok: false, reason: 'Заверши выборы предыстории' }
      if (!bgLangsComplete.value) return { ok: false, reason: 'Выбери языки предыстории' }
      return { ok: true }
    case 'stats':
      if (!scoresComplete.value) return { ok: false, reason: 'Заполни все характеристики' }
      if (pointsLeft.value < 0) return { ok: false, reason: 'Превышен бюджет очков' }
      return { ok: true }
    case 'shop':
      if (!state.startingWealthRoll) return { ok: false, reason: 'Брось начальное богатство' }
      if (shopSpentCopper.value > startingWealthCopper.value) return { ok: false, reason: 'Превышен бюджет магазина' }
      return { ok: true }
    case 'persona':
      if (!state.name.trim()) return { ok: false, reason: 'Впиши имя персонажа' }
      return { ok: true }
    default:
      return { ok: true }
  }
}
const validation = computed(() => validateStep(stepKey.value))
const canNext = computed(() => validation.value.ok)
const blockReason = computed(() => (validation.value.ok ? '' : validation.value.reason))
const isFullyValid = computed(() => steps.value.every((step) => validateStep(step.key).ok))

// Furthest step the user may jump to via the rail: the first invalid step (which
// still needs filling), or the last step when everything so far is valid. Going
// back never locks the forward steps you already completed.
const maxReachable = computed(() => {
  const list = steps.value
  for (let i = 0; i < list.length; i++) {
    if (!validateStep(list[i].key).ok) return i
  }
  return list.length - 1
})

function next() {
  if (!canNext.value) { focusInvalidChoice(); return }
  state.step++
}

function focusInvalidChoice() {
  const root = mainRef.value
  if (!root) return
  let target = null
  if (stepKey.value === 'stats') target = [...root.querySelectorAll('.stat')].find(node => node.querySelector('select')?.value === '')
  else if (stepKey.value === 'persona') target = root.querySelector('input')
  else target = root.querySelector('.off, .pick, .opts, .selection-details, .grid, input, select')
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  target?.querySelector?.('input, select, button')?.focus?.({ preventScroll: true })
  invalidPulse.value = false
  requestAnimationFrame(() => { invalidPulse.value = true; setTimeout(() => { invalidPulse.value = false }, 650) })
}
function back() {
  if (current.value === 0) { exit(); return }
  state.step--
}
function goTo(i) { if (i <= maxReachable.value) state.step = i }
function exit() {
  if (props.embedded) emit('cancel')
  else router.push('/chars')
}

// "Создать" is available on every step (an empty character is allowed) — confirm
// first when something's missing, then build with whatever's filled (blanks default).
function createNow() {
  if (creating.value) return
  if (accountStore.authStatus !== 'success') {
    window.dispatchEvent(new CustomEvent('dndshare:request-auth'))
    return
  }
  if (isComplete.value) submit()
  else confirmOpen.value = true
}

function createIncomplete() {
  if (creating.value) return
  if (accountStore.authStatus !== 'success') {
    window.dispatchEvent(new CustomEvent('dndshare:request-auth'))
    return
  }
  confirmOpen.value = true
}

const previewDraft = ref(null)

function openPreview() {
  const template = templateStore.byId(dndTemplateId.value)
  if (!template) return
  const payload = buildPayload()
  previewDraft.value = {
    templateName: template.name,
    data: payload.data,
    publicVisible: false,
    userId: null,
    version: 0,
    sourceVersionId: sourceVersionId.value,
    iconImageId: null,
    iconImageUrl: state.persona?.icon?.url || null,
  }
}

async function submit() {
  confirmOpen.value = false
  if (creating.value || !dndTemplateId.value || !sourceVersionId.value) return
  const payload = {
    templateId: dndTemplateId.value,
    sourceVersionId: sourceVersionId.value,
    ...buildPayload(),
  }
  if (props.embedded) {
    emit('create', payload)
    return
  }
  internalCreating.value = true
  try {
    const res = await fetchPost('/chars', payload)
    if (res?.uuid) {
      accountStore.setHasCharacters(true)
      setCharSeed(res.uuid, {
        data: payload.data,
        version: 0,
        userId: accountStore.user?.id,
        publicVisible: false,
        templateId: dndTemplateId.value,
        sourceVersionId: sourceVersionId.value,
      })
      clearPersist()
      router.push('/char/' + res.uuid)
    }
  } finally {
    internalCreating.value = false
  }
}

defineExpose({ clearDraft: clearPersist })

onMounted(async () => {
  accountStore.ensureAuth()
  const [, sourcesRes] = await Promise.all([templateStore.ensure(), fetchGet('/sources')])
  dndTemplateId.value = templateStore.all.find((t) => resolveSetting(t)?.system === 'dnd5e')?.id ?? null
  dndSource.value = (sourcesRes?.sources || []).find((source) => source.name.toLowerCase() === 'dnd5e') || null
  setSourceVersionId(sourceVersionId.value)
  await load()
  await restore()
  await load()
})
</script>

<style scoped>
.cc {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: calc(100vh - var(--header-h));
  max-width: none;
  box-sizing: border-box;
  background: transparent;
  color: var(--text-1);
}

.cc--embedded {
  width: 100%;
  max-width: none;
  height: 100%;
  border-inline: none;
}

.cc-head,
.cc-body,
.cc-foot {
  --cc-main-max: 1120px;
  display: grid;
  grid-template-columns: 220px minmax(0, var(--cc-main-max));
  justify-content: center;
  gap: 24px;
  padding-inline: 24px;
}
.cc-head-main {
  grid-column: 2;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 16px 12px;
  background: var(--bg);
}
.cc-head-main,
.cc-main,
.cc-foot-main {
  border-inline: 1px solid color-mix(in srgb, var(--border-strong) 62%, transparent);
}
.cc-x {
  width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
  background: none; border: none; color: var(--text-muted); cursor: pointer; border-radius: 8px;
}
.cc-x:hover { background: color-mix(in srgb, var(--text-on-accent) 5%, transparent); color: var(--text-1); }
.cc-x svg { width: 18px; height: 18px; }
.cc-title { display: flex; align-items: center; gap: 9px; font-family: var(--font-display); font-size: 23px; font-weight: 600; color: var(--warning); }
.cc-title svg { width: 20px; height: 20px; color: var(--accent); }
.cc-mobile-reset { display: none; }

.cc-body {
  flex: 1;
  min-height: 0;
}
.cc-rail {
  box-sizing: border-box;
  width: 100%;
}
.cc-rail { position: sticky; top: 0; align-self: start; }
.cc-main {
  grid-column: 2;
  min-width: 0;
  overflow-x: clip;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scrollbar-gutter: stable;
  padding: 4px 16px 16px;
  background: var(--bg);
}

.cc-fade-enter-active, .cc-fade-leave-active { transition: opacity 0.16s ease; }
.cc-fade-enter-from, .cc-fade-leave-to { opacity: 0; }

.cc-foot {
  background: transparent;
}
.cc-foot-main {
  grid-column: 2;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-top: 1px solid color-mix(in srgb, var(--border-strong) 72%, transparent);
  background: var(--bg);
}
.cc-reason { font-size: 12px; color: var(--text-muted); }
.cc-error { max-width: 520px; color: var(--danger); font-size: 12px; }
.cc-actions { margin-left: auto; display: flex; gap: 10px; }
.btn { border: none; border-radius: 9px; padding: 10px 22px; font: inherit; font-weight: 600; cursor: pointer; }
.btn.disabled { opacity: .48; cursor: pointer; }
.cc-main--invalid { animation: cc-invalid .6s ease; }
@keyframes cc-invalid { 0%, 100% { box-shadow: none; } 35% { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--danger) 72%, transparent); } }
.btn.ghost { background: transparent; color: var(--text-2); box-shadow: inset 0 0 0 1px var(--border-strong); }
.btn.ghost:hover { color: var(--text-1); }
.btn.incomplete-mobile { display: none; background: transparent; color: var(--text-muted); padding-inline: 8px; font-size: 10px; font-weight: 500; }
.btn.incomplete-mobile:hover:not(:disabled) { color: var(--text-2); }
.btn.soft { background: transparent; color: var(--text-muted); padding-inline: 14px; font-size: 13px; }
.btn.soft:hover:not(:disabled) { background: color-mix(in srgb, var(--text-on-accent) 5%, transparent); color: var(--text-1); }
.btn.next { background: var(--accent); color: var(--text-on-accent); }
.btn.next:hover:not(:disabled) { background: var(--accent-hover); }
.btn.create { background: var(--accent); color: var(--text-on-accent); }
.btn.create:hover:not(:disabled) { background: var(--accent-hover); }
.btn:disabled { opacity: 0.5; cursor: default; }

@media (max-width: 920px) {
  .cc-head, .cc-body, .cc-foot { grid-template-columns: minmax(0, 1fr); padding-inline: 0; }
  .cc-head-main, .cc-main, .cc-foot-main { grid-column: 1; }
  .cc-head-main { padding-inline: 24px; }
  .cc-mobile-reset {
    margin-left: auto; display: inline-flex; align-items: center; gap: 5px; padding: 6px 7px;
    border: 0; border-radius: 7px; background: transparent; color: var(--text-muted); font: inherit; font-size: 10px; cursor: pointer;
  }
  .cc-mobile-reset:hover { color: var(--danger); background: color-mix(in srgb, var(--danger) 9%, transparent); }
  .cc-mobile-reset svg { width: 13px; height: 13px; }
  .cc-rail { display: none; }
  .cc-main { padding-inline: 24px; }
  .cc-foot-main { padding-inline: 24px; }
  .cc { height: calc(100vh - var(--header-h)); height: calc(100dvh - var(--header-h)); min-height: 0; }
  .cc.cc--embedded { height: 100%; min-height: 0; }
}

@media (max-width: 640px) {
  .cc { border-inline: none; }
  .cc-head-main, .cc-main, .cc-foot-main { border-inline: none; }
  .cc-head-main { gap: 8px; padding: 14px 14px 10px; }
  .cc-x { width: 28px; height: 28px; }
  .cc-title { gap: 7px; font-size: 20px; white-space: nowrap; }
  .cc-title svg { width: 17px; height: 17px; }
  .cc-main { padding: 4px 20px 14px; }
  .cc-foot {
    position: sticky;
    bottom: 0;
    z-index: 20;
  }
  .cc-foot-main {
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px 20px max(12px, env(safe-area-inset-bottom));
  }
  .cc-error { order: -1; flex: 0 0 100%; max-width: none; }
  .cc-actions { gap: 6px; }
  .btn { padding: 10px 18px; }
  .btn.incomplete-mobile { display: inline-flex; }
  .btn.soft { padding-inline: 10px; }
}
</style>
