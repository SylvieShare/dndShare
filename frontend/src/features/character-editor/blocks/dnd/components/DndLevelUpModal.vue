<template>
  <AppModalFrame title="Повышение уровня" :subtitle="`${total} → ${newTotal}`" @close="$emit('close')">

    <p v-if="loading" class="lu-muted">Загрузка справочника…</p>

    <!-- ── Шаг 1: за кого повышаемся ── -->
    <template v-else-if="step === 'pick'">
      <div class="lu-sub">За какой класс берём уровень?</div>
      <div class="lu-opts">
        <button v-for="(e, i) in entries" :key="e.id" class="lu-opt" :disabled="e.level >= 20" @click="chooseClass(i)">
          <span class="lu-opt-mono">{{ monogram(e.name) }}</span>
          <span class="lu-opt-body">
            <span class="lu-opt-name">{{ e.name }}<span v-if="e.subclass" class="lu-opt-sub"> · {{ e.subclass.name }}</span></span>
            <span class="lu-opt-lvl">{{ e.level }} <span class="lu-arrow">→</span> {{ e.level + 1 }} уровень</span>
          </span>
        </button>

        <button class="lu-opt lu-opt-ghost" @click="step = 'newclass'">
          <span class="lu-opt-mono lu-opt-plus">+</span>
          <span class="lu-opt-body">
            <span class="lu-opt-name">Взять новый класс</span>
            <span class="lu-opt-lvl">мультикласс — 1 уровень нового класса</span>
          </span>
        </button>

        <button class="lu-opt lu-opt-plain" @click="choosePlain">
          <span class="lu-opt-mono lu-opt-plus">↑</span>
          <span class="lu-opt-body">
            <span class="lu-opt-name">Просто повысить уровень</span>
            <span class="lu-opt-lvl">без классовых умений — только уровень листа</span>
          </span>
        </button>
      </div>
    </template>

    <!-- ── Шаг 1б: выбор нового класса ── -->
    <template v-else-if="step === 'newclass'">
      <div class="lu-sub">
        <button class="lu-back" @click="step = 'pick'">←</button>
        Новый класс
      </div>
      <div class="lu-opts lu-opts-grid">
        <button
          v-for="c in newClassOptions"
          :key="c.id"
          class="lu-opt"
          @click="chooseNew(c)"
        >
          <span class="lu-opt-mono">{{ monogram(c.name) }}</span>
          <span class="lu-opt-body">
            <span class="lu-opt-name">{{ c.name }}</span>
            <span class="lu-opt-lvl" :class="{ 'lu-warn': !prereq(c).ok }">
              {{ prereq(c).ok ? 'требования выполнены' : 'нужно: ' + prereqLabel(c) }}
            </span>
          </span>
        </button>
      </div>
    </template>

    <!-- ── Шаг 2: что получаешь ── -->
    <template v-else-if="step === 'preview'">
      <div class="lu-sub">
        <button class="lu-back" @click="backToPick">←</button>
        <template v-if="isPlain">Уровень {{ newTotal }}</template>
        <template v-else>{{ classItem?.name }} · {{ isNew ? 'уровень 1' : `${targetEntry.level} → ${targetEntry.level + 1} уровень` }}</template>
      </div>

      <div v-if="isNew && !newPrereq.ok" class="lu-note lu-note-warn">
        Требование мультикласса не выполнено: {{ prereqLabel(classItem) }}. Взять класс всё равно можно — реши с мастером.
      </div>
      <div v-if="isNew && newProfs" class="lu-note">
        <b>Владения при мультиклассе:</b> {{ newProfs }}. Добавь их в блок владений вручную.
      </div>

      <!-- субкласс -->
      <div v-if="needSubclass" class="lu-sec">
        <div class="lu-sec-title">Выбери архетип <span class="lu-req" :class="{ done: !!subclassPick }">{{ subclassPick ? '✓' : 'обязательно' }}</span></div>
        <div class="lu-opts lu-opts-grid">
          <button
            v-for="s in subclassOptions"
            :key="s.id"
            class="lu-opt lu-opt-slim"
            :class="{ on: subclassPick?.id === s.id }"
            @click="subclassPick = s"
          >
            <span class="lu-opt-name">{{ s.name }}</span>
          </button>
        </div>
      </div>

      <!-- фичи нового уровня -->
      <div v-if="!isPlain" class="lu-sec">
        <div class="lu-sec-title">Новые умения</div>
        <p v-if="!features.length" class="lu-muted">На этом уровне класс не даёт новых умений{{ needSubclass && !subclassPick ? ' (выбери архетип — возможно, добавятся)' : '' }}.</p>
        <div v-for="f in features" :key="f.id" class="lu-feat">
          <div class="lu-feat-head">
            <span class="lu-feat-name">{{ f.name }}</span>
            <button class="lu-feat-view" title="Открыть" @click="viewFeature = f.id">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" /><circle cx="12" cy="12" r="3" /></svg>
            </button>
          </div>
          <div v-if="featSnippet(f)" class="lu-feat-desc">{{ featSnippet(f) }}</div>
          <template v-if="featChoice(f)">
            <div class="lu-feat-choice-title">
              {{ featChoice(f).text || 'Сделай выбор' }}
              <span class="lu-req" :class="{ done: choiceCompleteFor(f) }">{{ choiceSel(f.id).length }} / {{ choiceCount(f) }}</span>
            </div>
            <div class="lu-chips">
              <button
                v-for="opt in choiceOptions(f)"
                :key="opt.value"
                class="lu-chip"
                :class="{ on: choiceSel(f.id).some((v) => String(v) === String(opt.value)), off: choiceLocked(f, opt) }"
                :title="opt.desc || ''"
                @click="toggleFeatureChoice(f, opt.value)"
              >{{ opt.label }}</button>
            </div>
          </template>
        </div>
      </div>

      <!-- даруемые заклинания (домен/клятва/круг) -->
      <div v-if="grantedSpellList.length" class="lu-sec">
        <div class="lu-sec-title">Заклинания архетипа</div>
        <p class="lu-muted">Всегда подготовлены и не учитываются в числе подготовленных.</p>
        <div class="lu-chips">
          <span v-for="sp in grantedSpellList" :key="sp.id" class="lu-spell-tag">{{ sp.name }}</span>
        </div>
      </div>

      <!-- хиты -->
      <div v-if="!isPlain" class="lu-sec">
        <div class="lu-sec-title">Хиты</div>
        <div class="lu-hp">
          <MultiToggle :options="hpModes" :model-value="hpMode" @update:model-value="setHpMode" />
          <div class="lu-hp-val">
            <template v-if="hpMode === 'manual'">
              <FormNumberInput class="lu-hp-input" :value="hpManual ?? hpAvg" :min="1" :max="99" @change="hpManual = $event" />
            </template>
            <template v-else-if="hpMode === 'roll'">
              <button v-if="hpRoll == null" class="lu-roll" @click="rollHp">🎲 Бросить {{ hitDieLabel }}</button>
              <span v-else class="lu-hp-n">{{ hpRoll }} <button class="lu-reroll" title="Перебросить" @click="rollHp">↻</button></span>
            </template>
            <span class="lu-hp-total">+{{ hpGain }} хитов <span class="lu-muted">({{ hpBreakdown }})</span></span>
          </div>
        </div>
      </div>

      <!-- ASI -->
      <div v-if="asiNow" class="lu-sec">
        <div class="lu-sec-title">
          Повышение характеристик
          <span class="lu-req" :class="{ done: asiComplete || asiSkipped }">{{ asiComplete || asiSkipped ? '✓' : 'сделай выбор' }}</span>
        </div>
        <template v-if="!asiSkipped">
          <MultiToggle :options="asiModes" :model-value="asiMode" @update:model-value="setAsiMode" />
          <div v-if="asiMode !== 'feat'" class="lu-chips">
            <button
              v-for="s in STATS"
              :key="s"
              class="lu-chip"
              :class="{ on: asiStats.includes(s), off: asiChipLocked(s) }"
              @click="toggleAsiStat(s)"
            >
              {{ STAT_SHORT[s] }} {{ statScore(s) }}<template v-if="asiStats.includes(s)"> → {{ statScore(s) + asiDelta }}</template>
            </button>
          </div>
          <template v-else>
            <button v-if="!featPick" class="lu-roll" @click="featPickerOpen = true">Выбрать черту…</button>
            <div v-else class="lu-feat">
              <div class="lu-feat-head">
                <span class="lu-feat-name">{{ featPick.name }}</span>
                <button class="lu-feat-view" title="Сменить" @click="featPickerOpen = true">↻</button>
              </div>
            </div>
          </template>
        </template>
        <button class="lu-skip" @click="asiSkipped = !asiSkipped">{{ asiSkipped ? 'Вернуться к выбору' : 'Пропустить — решу позже' }}</button>
      </div>

      <!-- сводка прочих изменений -->
      <div class="lu-sec">
        <div class="lu-sec-title">Также изменится</div>
        <ul class="lu-list">
          <li>Уровень персонажа: <b>{{ total }} → {{ newTotal }}</b></li>
          <li v-if="!isPlain && hitDieLabel">Кости хитов: <b>+1 {{ hitDieLabel }}</b></li>
          <li v-if="profChanges">Бонус мастерства: <b>+{{ profBefore }} → +{{ profAfter }}</b></li>
          <li v-if="slotDiff.length">
            <label class="lu-slots-check">
              <input type="checkbox" v-model="applySlots" />
              Ячейки заклинаний: <b>{{ slotDiff.map(d => `${d.level} круг ${d.from} → ${d.to}`).join(', ') }}</b>
            </label>
          </li>
          <li v-if="slotsAfter?.pact && !slotsAfter.pactMerged" class="lu-muted">
            Ячейки колдуна ({{ slotsAfter.pact.count }} × {{ slotsAfter.pact.slotLevel }} круга, короткий отдых) — отдельный ресурс, ячейки листа их не включают.
          </li>
        </ul>
      </div>

    </template>

    <ItemViewModal
      v-if="viewFeature != null"
      :item-type-id="4"
      :item-id="viewFeature"
      @close="viewFeature = null"
    />

    <ItemPickerModal
      v-if="featPickerOpen"
      :item-type-ids="[7]"
      title="Выбор черты"
      search-placeholder="Поиск черты…"
      :item-eligibility="featEligibility"
      @pick="onFeatPick"
      @close="featPickerOpen = false"
    />

    <FeatChoiceModal
      v-if="featConfigItem"
      :item="featConfigItem"
      :initial-choices="featConfigItem.selectedChoices || {}"
      :excluded-choices="featExcludedChoices"
      @confirm="onFeatChoicesConfirm"
      @close="featConfigItem = null"
    />
    <template v-if="step === 'preview'" #footer>
      <div class="lu-actions">
        <button class="lu-btn ghost" @click="$emit('close')">Отмена</button>
        <button class="lu-btn" :disabled="!canAccept" @click="accept">Принять</button>
      </div>
    </template>
  </AppModalFrame>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue'
import AppModalFrame from '@/shared/ui/AppModalFrame.vue'
import FeatChoiceModal from '@/features/character-editor/components/FeatChoiceModal.vue'
import FormNumberInput from '@/shared/ui/form/FormNumberInput'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import MultiToggle from '@/shared/ui/MultiToggle.vue'
import { abilityModifier, proficiencyBonus, resolveNumValue } from '@/shared/lib/dnd'
import { STAT_KEYS, STAT_SHORT } from '@/shared/lib/dndStats'
import {
  avgHitDie, chosenOptionLabels, classEntriesOf, computeSlots,
  dieFaceOf, grantedSpellsAt, multiclassCheck,
  MULTICLASS_PROFS, parseAsiLevels, totalLevel,
} from '@/features/character-editor/blocks/dnd/lib/levelUp'
import { featuresForBinding } from '@/features/character-editor/settings/dnd/creation/progression'
import { fetchGet } from '@/shared/api/http'
import { itemsApi } from '@/shared/api/itemsApi'
import { contentScopeQuery } from '@/shared/api/contentSourcesApi'
import { useDiceStore } from '@/stores/dice'
import { useSuggestStore } from '@/stores/suggest'
import { dieLabel } from '@/shared/lib/systemDice'
import { useLevelUpFeatureChoices } from './useLevelUpFeatureChoices'
import { buildLevelUpUpdates } from './buildLevelUpUpdates'
import { useLevelUpFeatSelection } from './useLevelUpFeatSelection'
import { useLevelUpTarget } from './useLevelUpTarget'
import { useGrantedSpellNames } from './useGrantedSpellNames'
import { featSnippet, hitDieLabel as resolveHitDieLabel, monogram, multiclassPrerequisiteLabel } from './levelUpPresentation'
import { levelUpSessionAdditions } from '@/features/character-editor/blocks/dnd/lib/levelUpSessionAdditions'

const CLASS_TYPE = 9
const CLASS_ABIL_TYPE = 4
const STATS = STAT_KEYS

const props = defineProps({ values: { type: Object, required: true } })
const emit = defineEmits(['close', 'apply'])

const dice = useDiceStore()
const suggestStore = useSuggestStore()
const charCtx = inject('charCtx', {})
const sourceSuffix = () => contentScopeQuery(charCtx.contentSources, charCtx.sourceVersionId)
;[3, 4, 5, 6, 15, 16].forEach((typeId) => suggestStore.ensure(typeId))

const loading = ref(true)
const step = ref('pick')
const entries = ref(classEntriesOf(props.values))
const itemsById = ref({})
const abilityPool = ref([])
const baseClasses = ref([])
const subclassOptions = ref([])
const subclassPick = ref(null)
const hpMode = ref('avg')
const hpRoll = ref(null)
const hpManual = ref(null)
const asiMode = ref('+2')
const asiStats = ref([])
const asiSkipped = ref(false)
const applySlots = ref(true)
const viewFeature = ref(null)

const {
  target,
  isPlain,
  isNew,
  targetEntry,
  classItem,
  newClassLevel,
  effectiveSubclass,
  needSubclass,
  newClassOptions,
} = useLevelUpTarget({ entries, itemsById, baseClasses, subclassOptions, subclassPick })

const total = computed(() => Math.max(totalLevel(entries.value), parseInt(props.values?.lvl?.level) || 1))
// Первый класс на пустом листе — это не рост уровня, а становление 1-м уровнем.
const newTotal = computed(() => (isNew.value && !entries.value.length
  ? Math.max(1, total.value)
  : Math.min(20, total.value + 1)))

// ─── фичи нового уровня ─────────────────────────────────────────────────────
function isSubclassBound(item) {
  const d = item?.data || {}
  return Array.isArray(d.subclass_ids) && d.subclass_ids.length > 0
}
const features = computed(() => {
  if (isPlain.value || !classItem.value) return []
  const binding = { classId: classItem.value.id, subclassId: effectiveSubclass.value?.id }
  if (isNew.value) return featuresForBinding(abilityPool.value, binding, 1)
  const exact = featuresForBinding(abilityPool.value, binding, newClassLevel.value, { cumulative: false })
  if (subclassPick.value) {
    // Архетип выбран прямо сейчас — добираем все его умения до текущего уровня.
    const sub = featuresForBinding(abilityPool.value, binding, newClassLevel.value).filter(isSubclassBound)
    const seen = new Set(exact.map((f) => f.id))
    return [...exact, ...sub.filter((f) => !seen.has(f.id))]
  }
  return exact
})

const {
  featureChoice: featChoice,
  selections: featureChoiceSel,
  choiceCount,
  choiceOptions,
  selected: choiceSel,
  choiceLocked,
  toggleChoice: toggleFeatureChoice,
  choiceComplete: choiceCompleteFor,
  complete: featureChoicesComplete,
} = useLevelUpFeatureChoices(features, suggestStore)

// ─── даруемые заклинания (домен/клятва/круг) ────────────────────────────────
const effectiveSubclassItem = computed(() => (subclassPick.value
  ? subclassPick.value
  : (targetEntry.value?.subclass ? itemsById.value[targetEntry.value.subclass.id] : null)))
const grantedRows = computed(() => {
  if (isPlain.value || !classItem.value) return []
  const items = [classItem.value, effectiveSubclassItem.value].filter(Boolean)
  const options = chosenOptionLabels(props.values?.feature_choices, featureChoiceSel.value)
  if (isNew.value) return grantedSpellsAt(items, 1, { options })
  // Только что выбранный архетип отдаёт весь накопленный список, иначе — дельту уровня.
  if (subclassPick.value) return grantedSpellsAt(items, newClassLevel.value, { options })
  return grantedSpellsAt(items, newClassLevel.value, { exact: true, options })
})
const grantedNewIds = computed(() => {
  const have = new Set((props.values?.spells?.spells || []).map((s) => s.id))
  return [...new Set(grantedRows.value.map((r) => r.spellId))].filter((id) => !have.has(id))
})
const { spellNames, grantedSpellList } = useGrantedSpellNames(grantedNewIds)

// ─── хиты ───────────────────────────────────────────────────────────────────
const hitDieLabelOf = (item) => resolveHitDieLabel(item, dieLabel)
const hitDieLabel = computed(() => hitDieLabelOf(classItem.value))
const hitDieFace = computed(() => dieFaceOf(hitDieLabel.value) || 8)
function statScore(s) {
  const v = props.values?.[s]
  const raw = v && typeof v === 'object' ? v.value : v
  return raw == null ? 10 : resolveNumValue(raw)
}
const conMod = computed(() => abilityModifier(statScore('CON')))
const hpAvg = computed(() => avgHitDie(hitDieFace.value))
const hpModes = [
  { value: 'avg', label: 'Среднее' },
  { value: 'roll', label: 'Бросок' },
  { value: 'manual', label: 'Вручную' },
]
function setHpMode(m) { hpMode.value = m; hpRoll.value = null }
function rollHp() {
  const r = dice.roll('Кость хитов', `1d${hitDieFace.value}`)
  hpRoll.value = r?.total ?? null
}
const hpDie = computed(() => {
  if (hpMode.value === 'manual') return Math.max(1, Number(hpManual.value ?? hpAvg.value) || 1)
  if (hpMode.value === 'roll') return hpRoll.value ?? hpAvg.value
  return hpAvg.value
})
const hpGain = computed(() => Math.max(1, hpDie.value + (hpMode.value === 'manual' ? 0 : conMod.value)))
const hpBreakdown = computed(() => (hpMode.value === 'manual'
  ? 'введено вручную'
  : `${hpDie.value} ${hpMode.value === 'roll' && hpRoll.value != null ? 'бросок' : hitDieLabel.value} ${conMod.value >= 0 ? '+' : ''}${conMod.value} ВЫН`))

// ─── ASI ────────────────────────────────────────────────────────────────────
const asiNow = computed(() => !isPlain.value && !isNew.value && classItem.value
  && parseAsiLevels(classItem.value.data?.asi_levels).includes(newClassLevel.value))
const asiModes = [
  { value: '+2', label: '+2 к одной' },
  { value: '+1+1', label: '+1 к двум' },
  { value: 'feat', label: 'Черта' },
]
const asiDelta = computed(() => (asiMode.value === '+2' ? 2 : 1))
const asiLimit = computed(() => (asiMode.value === '+2' ? 1 : 2))
function setAsiMode(m) { asiMode.value = m; asiStats.value = []; featPick.value = null; featConfigItem.value = null }
function asiChipLocked(s) {
  if (asiStats.value.includes(s)) return false
  if (asiStats.value.length >= asiLimit.value) return true
  return statScore(s) + asiDelta.value > 20
}
function toggleAsiStat(s) {
  const i = asiStats.value.indexOf(s)
  if (i >= 0) { asiStats.value.splice(i, 1); return }
  if (asiChipLocked(s)) return
  asiStats.value.push(s)
}
const asiComplete = computed(() => {
  if (!asiNow.value) return true
  if (asiMode.value === 'feat') return !!featPick.value
  return asiStats.value.length === asiLimit.value
})
const {
  featPick,
  featPickerOpen,
  featConfigItem,
  featExcludedChoices,
  featEligibility,
  onFeatPick,
  onFeatChoicesConfirm,
} = useLevelUpFeatSelection({
  values: () => props.values,
  entries,
  itemsById,
  newTotal,
  suggestStore,
})

// ─── бонус мастерства / ячейки ──────────────────────────────────────────────
const profBefore = computed(() => proficiencyBonus(total.value))
const profAfter = computed(() => proficiencyBonus(newTotal.value))
const profChanges = computed(() => profBefore.value !== profAfter.value)

const entriesAfter = computed(() => {
  const next = entries.value.map((e) => ({ ...e, subclass: e.subclass ? { ...e.subclass } : null }))
  if (target.value?.kind === 'class') {
    const e = next[target.value.index]
    e.level += 1
    if (subclassPick.value) e.subclass = { id: subclassPick.value.id, name: subclassPick.value.name }
  } else if (target.value?.kind === 'new') {
    next.push({
      id: classItem.value.id,
      name: classItem.value.name,
      level: 1,
      subclass: subclassPick.value ? { id: subclassPick.value.id, name: subclassPick.value.name } : null,
    })
  }
  return next
})
const slotsCatalog = computed(() => {
  const map = { ...itemsById.value }
  if (isNew.value && classItem.value) map[classItem.value.id] = classItem.value
  if (subclassPick.value) map[subclassPick.value.id] = subclassPick.value
  return map
})
const slotsAfter = computed(() => (isPlain.value ? null : computeSlots(entriesAfter.value, slotsCatalog.value)))
const slotDiff = computed(() => {
  if (!slotsAfter.value?.isCaster) return []
  const cur = Array.isArray(props.values?.spells?.slots) ? props.values.spells.slots : []
  const out = []
  slotsAfter.value.totals.forEach((n, i) => {
    const from = Number(cur[i]?.total) || 0
    if (n !== from) out.push({ level: i + 1, from, to: n })
  })
  return out
})

// ─── выбор цели ─────────────────────────────────────────────────────────────
const scores = computed(() => Object.fromEntries(STATS.map((s) => [s, statScore(s)])))
function prereq(c) { return multiclassCheck(c, scores.value) }
const prereqLabel = multiclassPrerequisiteLabel
const newPrereq = computed(() => (classItem.value ? prereq(classItem.value) : { ok: true }))
const newProfs = computed(() => MULTICLASS_PROFS[String(classItem.value?.nameEn || '').trim().toLowerCase()] || '')

async function loadSubclasses(cls, currentLevel) {
  subclassOptions.value = []
  subclassPick.value = null
  const d = cls?.data || {}
  const at = Number(d.subclass_level) || 99
  if (at > currentLevel) return
  const res = await fetchGet(`/items/children?parentId=${cls.id}${sourceSuffix()}`)
  subclassOptions.value = (res?.items || []).filter((i) => i.typeId === CLASS_TYPE)
}

async function chooseClass(i) {
  target.value = { kind: 'class', index: i }
  resetPreview()
  step.value = 'preview'
  const e = entries.value[i]
  if (!e.subclass) await loadSubclasses(itemsById.value[e.id], e.level + 1)
}
async function chooseNew(item) {
  target.value = { kind: 'new', item }
  resetPreview()
  step.value = 'preview'
  await loadSubclasses(item, 1)
}
function choosePlain() {
  target.value = { kind: 'plain' }
  resetPreview()
  step.value = 'preview'
}
function backToPick() {
  step.value = 'pick'
  target.value = null
}
function resetPreview() {
  subclassOptions.value = []
  subclassPick.value = null
  hpMode.value = 'avg'
  hpRoll.value = null
  hpManual.value = null
  asiMode.value = '+2'
  asiStats.value = []
  asiSkipped.value = false
  featPick.value = null
  featConfigItem.value = null
  applySlots.value = true
  viewFeature.value = null
}

const canAccept = computed(() => {
  if (isPlain.value) return true
  if (!classItem.value) return false
  if (needSubclass.value && !subclassPick.value) return false
  if (asiNow.value && !asiSkipped.value && !asiComplete.value) return false
  if (!featureChoicesComplete.value) return false
  return true
})

// ─── применение ─────────────────────────────────────────────────────────────
async function accept() {
  if (!canAccept.value) return
  const updates = buildLevelUpUpdates({
    values: props.values || {},
    newTotal: newTotal.value,
    isPlain: isPlain.value,
    entriesAfter: entriesAfter.value,
    features: features.value,
    itemsById: itemsById.value,
    hitDieLabelOf,
    hitDieLabel: hitDieLabel.value,
    hpGain: hpGain.value,
    asiNow: asiNow.value,
    asiSkipped: asiSkipped.value,
    asiMode: asiMode.value,
    featPick: featPick.value,
    suggestItems: (typeId) => suggestStore.items(typeId),
    asiStats: asiStats.value,
    asiDelta: asiDelta.value,
    featureChoiceSelections: featureChoiceSel.value,
    applySlots: applySlots.value,
    slotDiff: slotDiff.value,
    slotsAfter: slotsAfter.value,
    grantedNewIds: grantedNewIds.value,
    classItem: classItem.value,
  })
  const catalogItems = [...abilityPool.value, ...Object.values(itemsById.value)]
  if (featPick.value) catalogItems.push(featPick.value)
  const additions = await levelUpSessionAdditions({
    values: props.values, updates, catalogItems,
    spellNames: spellNames.value,
    loadItems: itemsApi.byIds,
  })
  emit('apply', updates, additions)
}
// ─── загрузка ───────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const ids = new Set()
    entries.value.forEach((e) => { ids.add(e.id); if (e.subclass) ids.add(e.subclass.id) })
    const [byIds, abils, classes] = await Promise.all([
      ids.size ? itemsApi.byIds([...ids]) : Promise.resolve({ items: [] }),
      fetchGet(`/items?typeId=${CLASS_ABIL_TYPE}&limit=500${sourceSuffix()}`),
      fetchGet(`/items?typeId=${CLASS_TYPE}&limit=300${sourceSuffix()}`),
    ])
    const map = {}
    ;(byIds?.items || []).forEach((it) => { map[it.id] = it })
    ;(classes?.items || []).forEach((it) => { if (!map[it.id]) map[it.id] = it })
    itemsById.value = map
    abilityPool.value = abils?.items || []
    baseClasses.value = (classes?.items || []).filter((i) => !i.parentId)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped src="./styles/DndLevelUpModal.css"></style>
