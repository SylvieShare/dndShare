<template>
  <AppModal tile @close="$emit('close')">
    <div class="lu-head">
      <div class="lu-title">Повышение уровня</div>
      <div class="lu-total">{{ total }} <span class="lu-arrow">→</span> {{ newTotal }}</div>
    </div>

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

        <button class="lu-opt lu-opt-ghost" @click="choosePlain">
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

      <div class="lu-actions">
        <button class="lu-btn ghost" @click="$emit('close')">Отмена</button>
        <button class="lu-btn" :disabled="!canAccept" @click="accept">Принять</button>
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
  </AppModal>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue'
import AppModal from '@/shared/ui/AppModal'
import FeatChoiceModal from '@/features/character-editor/components/FeatChoiceModal.vue'
import FormNumberInput from '@/shared/ui/form/FormNumberInput'
import ItemPickerModal from '@/features/character-editor/components/ItemPickerModal.vue'
import ItemViewModal from '@/shared/ui/ItemViewModal'
import MultiToggle from '@/shared/ui/MultiToggle.vue'
import { abilityModifier, proficiencyBonus, resolveNumValue } from '@/shared/lib/dnd'
import { STAT_KEYS, STAT_SHORT } from '@/shared/lib/dndStats'
import {
  avgHitDie, castingAbilityIdOf, chosenOptionLabels, classEntriesOf, computeSlots,
  dieFaceOf, grantedSpellsAt, multiclassCheck,
  MULTICLASS_PROFS, MULTICLASS_REQS, parseAsiLevels, totalLevel,
} from '@/features/character-editor/blocks/dnd/lib/levelUp'
import { defaultSlots } from '@/features/character-editor/blocks/dnd/lib/spellEntry'
import {
  abilityScoresFromValues,
  evaluateFeatEligibility,
  featAbilityBonuses,
  featChoices,
  featEntry,
  featGrantedSpellIds,
  featGrants,
} from '@/features/items/lib/featRules'
import { SKILL_BY_STAT } from '@/features/character-editor/settings/dnd/creation/buildCharacter'
import { featuresForBinding } from '@/features/character-editor/settings/dnd/creation/progression'
import { fetchGet } from '@/shared/api/http'
import { itemsApi } from '@/shared/api/itemsApi'
import { contentScopeQuery } from '@/shared/api/contentSourcesApi'
import { useDiceStore } from '@/stores/dice'
import { useSuggestStore } from '@/stores/suggest'
import {
  addHitDie,
  hitDiceFromClasses,
  withHitDice,
} from '@/features/character-editor/blocks/dnd/lib/hitDice'

const CLASS_TYPE = 9
const CLASS_ABIL_TYPE = 4
const STATS = STAT_KEYS

const props = defineProps({ values: { type: Object, required: true } })
const emit = defineEmits(['close', 'apply'])

const dice = useDiceStore()
const suggestStore = useSuggestStore()
const charCtx = inject('charCtx', {})
const sourceSuffix = () => contentScopeQuery(charCtx.contentSources, charCtx.sourceVersionId)
suggestStore.ensure(11)
;[3, 4, 5, 6, 15, 16].forEach((typeId) => suggestStore.ensure(typeId))

const loading = ref(true)
const step = ref('pick')
const entries = ref(classEntriesOf(props.values))
const itemsById = ref({})
const abilityPool = ref([])
const baseClasses = ref([])
const target = ref(null) // { kind: 'class'|'new'|'plain', index?, item? }
const subclassOptions = ref([])
const subclassPick = ref(null)
const hpMode = ref('avg')
const hpRoll = ref(null)
const hpManual = ref(null)
const asiMode = ref('+2')
const asiStats = ref([])
const asiSkipped = ref(false)
const featPick = ref(null)
const featPickerOpen = ref(false)
const featConfigItem = ref(null)
const applySlots = ref(true)
const viewFeature = ref(null)

const total = computed(() => Math.max(totalLevel(entries.value), parseInt(props.values?.lvl?.level) || 1))
// Первый класс на пустом листе — это не рост уровня, а становление 1-м уровнем.
const newTotal = computed(() => (isNew.value && !entries.value.length
  ? Math.max(1, total.value)
  : Math.min(20, total.value + 1)))

const isPlain = computed(() => target.value?.kind === 'plain')
const isNew = computed(() => target.value?.kind === 'new')
const targetEntry = computed(() => (target.value?.kind === 'class' ? entries.value[target.value.index] : null))
const classItem = computed(() => {
  if (target.value?.kind === 'new') return target.value.item
  if (targetEntry.value) return itemsById.value[targetEntry.value.id] || null
  return null
})
const newClassLevel = computed(() => (isNew.value ? 1 : (targetEntry.value?.level || 0) + 1))
const effectiveSubclass = computed(() => subclassPick.value || targetEntry.value?.subclass || null)

const needSubclass = computed(() => {
  const d = classItem.value?.data || {}
  const at = Number(d.subclass_level) || 99
  return !isPlain.value && at <= newClassLevel.value && !targetEntry.value?.subclass && subclassOptions.value.length > 0
})

// ─── фичи нового уровня ─────────────────────────────────────────────────────
function isSubclassBound(item) {
  const d = item?.data || {}
  return d.subclass_id != null || (Array.isArray(d.subclass_ids) && d.subclass_ids.length > 0)
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

function featSnippet(f) {
  const raw = f.data?.desc || f.data?.description || ''
  const text = String(raw).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > 180 ? text.slice(0, 177).trim() + '…' : text
}

// ─── выборы у получаемых фич (местность круга, стиль боя, тотем…) ──────────
const featureChoiceSel = ref({}) // abilityId → [выбранные значения]
function featChoice(f) {
  const c = f?.data?.choice
  if (!c) return null
  return (c.from_suggest_id || (Array.isArray(c.options) && c.options.length)) ? c : null
}
const choosableFeatures = computed(() => features.value.filter((f) => featChoice(f)))
watch(choosableFeatures, (list) => {
  list.forEach((f) => {
    const c = featChoice(f)
    if (c?.from_suggest_id) suggestStore.ensure(Number(c.from_suggest_id))
  })
}, { immediate: true })
function choiceCount(f) { return Number(featChoice(f)?.count) || 1 }
function choiceOptions(f) {
  const c = featChoice(f)
  if (!c) return []
  if (c.from_suggest_id) {
    return suggestStore.items(Number(c.from_suggest_id)).map((it) => ({ value: it.id, label: it.value }))
  }
  return (c.options || []).map((o) => ({ value: o.label, label: o.label, desc: o.desc }))
}
function choiceSel(abilityId) { return featureChoiceSel.value[abilityId] || [] }
function choiceLocked(f, opt) {
  const sel = choiceSel(f.id)
  if (sel.some((v) => String(v) === String(opt.value))) return false
  return sel.length >= choiceCount(f)
}
function toggleFeatureChoice(f, value) {
  const cur = choiceSel(f.id)
  const has = cur.some((v) => String(v) === String(value))
  let next
  if (choiceCount(f) === 1) next = has ? [] : [value]
  else if (has) next = cur.filter((v) => String(v) !== String(value))
  else next = cur.length < choiceCount(f) ? [...cur, value] : cur
  featureChoiceSel.value = { ...featureChoiceSel.value, [f.id]: next }
}
function choiceCompleteFor(f) { return choiceSel(f.id).length === choiceCount(f) }
const featureChoicesComplete = computed(() => choosableFeatures.value.every(choiceCompleteFor))

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
const spellNames = ref({})
watch(grantedNewIds, async (ids) => {
  const missing = ids.filter((id) => !spellNames.value[id])
  if (!missing.length) return
  const res = await itemsApi.byIds(missing)
  const next = { ...spellNames.value }
  ;(res?.items || []).forEach((it) => { next[it.id] = it.name })
  spellNames.value = next
}, { immediate: true })
const grantedSpellList = computed(() => grantedNewIds.value.map((id) => ({ id, name: spellNames.value[id] || `#${id}` })))

// ─── хиты ───────────────────────────────────────────────────────────────────
function hitDieLabelOf(item) {
  const id = item?.data?.hit_die
  const label = suggestStore.items(11).find((s) => String(s.id) === String(id))?.value
  const face = dieFaceOf(label)
  return face ? `d${face}` : ''
}
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
const featRuleContext = computed(() => {
  const armorLabels = [
    ...(Array.isArray(props.values?.proficiencies?.['Доспехи']) ? props.values.proficiencies['Доспехи'] : []),
    ...(Array.isArray(props.values?.proficiencies_armor) ? props.values.proficiencies_armor : []),
  ]
  const armorProfIds = (suggestStore.items(3) || [])
    .filter((entry) => armorLabels.some((label) => String(label).toLowerCase() === String(entry.value).toLowerCase()))
    .map((entry) => entry.id)
  for (const entry of entries.value) {
    for (const id of (itemsById.value[entry.id]?.data?.armor_prof || [])) {
      if (!armorProfIds.includes(id)) armorProfIds.push(id)
    }
  }
  return {
    stats: abilityScoresFromValues(props.values),
    level: newTotal.value,
    spellcasting: !!props.values?.spells || entries.value.some((entry) => !!itemsById.value[entry.id]?.data?.spellcasting),
    armorProfIds,
  }
})

const featExcludedChoices = computed(() => {
  const item = featConfigItem.value
  if (!item?.data?.repeatable) return {}
  const uniqueKeys = new Set([
    item.data.unique_choice_key,
    ...featChoices(item).filter((choice) => choice.unique_across_takes).map((choice) => choice.key),
  ].filter(Boolean))
  const result = {}
  for (const entry of (props.values?.abilities_feats || []).filter((feat) => feat.id === item.id)) {
    for (const key of uniqueKeys) result[key] = [...(result[key] || []), ...(entry.choices?.[key] || [])]
  }
  return result
})

function featEligibility(item) {
  const result = evaluateFeatEligibility(item, featRuleContext.value)
  const alreadyTaken = (props.values?.abilities_feats || []).some((entry) => entry.id === item.id)
  if (alreadyTaken && !item.data?.repeatable) {
    return { ...result, eligible: false, reasons: [...result.reasons, 'Черта уже выбрана'] }
  }
  return result
}

function onFeatPick(item) {
  if (item?.id == null) return
  featPickerOpen.value = false
  if (featChoices(item).length) featConfigItem.value = item
  else featPick.value = { ...item, selectedChoices: {} }
}

function onFeatChoicesConfirm(choices) {
  featPick.value = { ...featConfigItem.value, selectedChoices: choices }
  featConfigItem.value = null
}

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
function monogram(name) { return String(name || '?').trim().charAt(0).toUpperCase() }
const newClassOptions = computed(() => {
  const taken = new Set(entries.value.map((e) => Number(e.id)))
  return baseClasses.value.filter((c) => !taken.has(Number(c.id)))
})
const scores = computed(() => Object.fromEntries(STATS.map((s) => [s, statScore(s)])))
function prereq(c) { return multiclassCheck(c, scores.value) }
function prereqLabel(c) {
  const key = String(c?.nameEn || '').trim().toLowerCase()
  const groups = MULTICLASS_REQS[key] || []
  return groups.map((alts) => alts.map((s) => `${STAT_SHORT[s]} 13`).join(' или ')).join(' и ')
}
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
function accept() {
  if (!canAccept.value) return
  const v = props.values || {}
  const updates = {}
  let featSpellIds = []

  updates.lvl = { exp: 0, ...(v.lvl || {}), level: newTotal.value }

  if (!isPlain.value) {
    const next = entriesAfter.value
    updates.classes = next
    updates.class = { id: next[0].id, name: next[0].name }
    updates.subclass = next[0].subclass ? { ...next[0].subclass } : null

    // умения → блок классовых способностей
    const cur = Array.isArray(v.abilities_class) ? v.abilities_class : []
    const have = new Set(cur.map((s) => s.id))
    const add = features.value.filter((f) => !have.has(f.id)).map((f) => {
      const maxUse = f.data?.max_use ?? null
      const entry = { id: f.id, count: maxUse ?? 0 }
      if (f.data?.manual_size) entry.max_use = maxUse ?? 0
      return entry
    })
    if (add.length) updates.abilities_class = [...cur, ...add]

    // хиты + кость хитов
    const hp = { ...(v.hp || {}) }
    hp.max = (Number(hp.max) || 0) + hpGain.value
    hp.current = Math.min(hp.max, (Number(hp.current) || 0) + hpGain.value)
    const classDice = next.map((entry) => hitDieLabelOf(itemsById.value[entry.id]))
    updates.hp = classDice.every(Boolean)
      ? withHitDice(hp, hitDiceFromClasses(hp, next, (entry) => hitDieLabelOf(itemsById.value[entry.id])))
      : addHitDie(hp, hitDieLabel.value || hp.dice || 'd8')

    // ASI
    if (asiNow.value && !asiSkipped.value) {
      if (asiMode.value === 'feat' && featPick.value) {
        const feats = Array.isArray(v.abilities_feats) ? v.abilities_feats : []
        if (featPick.value.data?.repeatable || !feats.some((f) => f.id === featPick.value.id)) {
          updates.abilities_feats = [...feats, featEntry(featPick.value, featPick.value.selectedChoices || {})]
        }

        const currentStatBlock = (stat) => ({ ...(updates[stat] || v[stat] || {}) })
        const writeStatBonus = (stat, title, bonus) => {
          const block = currentStatBlock(stat)
          const oldValue = block.value
          const base = oldValue && typeof oldValue === 'object'
            ? (Number(oldValue.base) || 0)
            : (oldValue == null ? 10 : Number(oldValue) || 0)
          const bonuses = oldValue && typeof oldValue === 'object' && Array.isArray(oldValue.bonuses) ? oldValue.bonuses : []
          const applied = Math.max(0, Math.min(Number(bonus) || 0, 20 - resolveNumValue(oldValue)))
          if (applied) updates[stat] = { ...block, value: { base, bonuses: [...bonuses, { title, value: applied }] } }
        }
        for (const bonus of featAbilityBonuses(featPick.value, featPick.value.selectedChoices || {})) {
          writeStatBonus(bonus.stat, featPick.value.name, bonus.bonus)
        }

        const selectedChoices = featPick.value.selectedChoices || {}
        const grant = featGrants(featPick.value, selectedChoices)
        featSpellIds = featGrantedSpellIds(featPick.value, selectedChoices)
        const profs = { ...(v.proficiencies || {}) }
        const addProf = (bucket, typeId, ids) => {
          if (!ids?.length) return
          const values = [...(profs[bucket] || [])]
          for (const id of ids) {
            const label = suggestStore.items(typeId).find((entry) => String(entry.id) === String(id))?.value
            if (label && !values.includes(label)) values.push(label)
          }
          profs[bucket] = values
        }
        addProf('Доспехи', 3, grant.armor_prof)
        addProf('Оружие', 4, grant.weapon_prof)
        addProf('Инструменты', 5, grant.tool_prof)
        addProf('Языки', 6, grant.languages)
        if (Object.keys(profs).length) updates.proficiencies = profs

        for (const skillId of (grant.skill_prof || [])) {
          const stat = SKILL_BY_STAT[String(skillId)]
          if (!stat) continue
          const block = currentStatBlock(stat)
          const saved = block.skills?.[String(skillId)] || {}
          updates[stat] = {
            ...block,
            skills: { ...(block.skills || {}), [String(skillId)]: { ...saved, up: Math.max(Number(saved.up) || 0, 1), override_title: saved.override_title || '', bonuses: saved.bonuses || [] } },
          }
        }
        for (const abilityId of (grant.save_prof || [])) {
          const stat = STAT_KEYS[Number(abilityId) - 1]
          if (stat) updates[stat] = { ...currentStatBlock(stat), save_up: true }
        }
      } else {
        for (const s of asiStats.value) {
          const old = v[s]
          const oldVal = old && typeof old === 'object' ? old.value : old
          const base = oldVal && typeof oldVal === 'object' ? (Number(oldVal.base) || 0) : (oldVal == null ? 10 : Number(oldVal) || 0)
          const bonuses = oldVal && typeof oldVal === 'object' && Array.isArray(oldVal.bonuses) ? oldVal.bonuses : []
          updates[s] = {
            ...(old && typeof old === 'object' ? old : {}),
            value: { base, bonuses: [...bonuses, { title: `Повышение (ур. ${newTotal.value})`, value: asiDelta.value }] },
          }
        }
      }
    }

    // выборы получаемых фич (местность круга, стиль боя…) → values.feature_choices
    const madeChoices = Object.entries(featureChoiceSel.value).filter(([, sel]) => sel.length)
    if (madeChoices.length) {
      updates.feature_choices = {
        ...(v.feature_choices && typeof v.feature_choices === 'object' ? v.feature_choices : {}),
        ...Object.fromEntries(madeChoices.map(([id, sel]) => [id, sel.slice()])),
      }
    }

    // ячейки заклинаний + даруемые заклинания архетипа
    const applySlotChange = applySlots.value && slotDiff.value.length && slotsAfter.value?.isCaster
    if (applySlotChange || grantedNewIds.value.length || featSpellIds.length) {
      const spells = v.spells && typeof v.spells === 'object'
        ? { ...v.spells }
        : { stat_path: castingAbilityIdOf(classItem.value) ?? '', spells: [], slots: defaultSlots() }
      if (applySlotChange) {
        const slots = Array.isArray(spells.slots) && spells.slots.length
          ? spells.slots.map((s) => ({ ...s }))
          : defaultSlots()
        slotsAfter.value.totals.forEach((n, i) => {
          slots[i] = { level: i + 1, used: 0, ...(slots[i] || {}), total: n }
        })
        spells.slots = slots
        if (slotsAfter.value.pactMerged) spells.slots_rest = 'short_rest'
      }
      if (grantedNewIds.value.length) {
        spells.spells = [...(spells.spells || []), ...grantedNewIds.value.map((id) => ({ id, prepared: true }))]
      }
      if (featSpellIds.length) {
        const existing = new Set((spells.spells || []).map((entry) => String(entry.id)))
        const added = featSpellIds
          .filter((id) => !existing.has(String(id)))
          .map((id) => ({ id, prepared: true, source: 'feat' }))
        spells.spells = [...(spells.spells || []), ...added]
      }
      updates.spells = spells
    }
  }

  emit('apply', updates)
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

<style scoped>
.lu-head { display: flex; align-items: baseline; gap: 12px; padding-right: 26px; }
.lu-title { font-size: 17px; font-weight: 700; color: var(--text-1); }
.lu-total { font-size: 14px; font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; }
.lu-arrow { color: var(--text-muted); font-weight: 400; }
.lu-muted { font-size: 12px; color: var(--text-muted); margin: 0; }
.lu-warn { color: var(--warning); }

.lu-sub { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--text-2); margin-top: 10px; }
.lu-back {
  display: grid; place-items: center; width: 24px; height: 24px;
  border: none; border-radius: 7px; background: var(--surface);
  color: var(--text-2); font-size: 14px; cursor: pointer;
}
.lu-back:hover { color: var(--text-1); background: color-mix(in srgb, var(--accent) 14%, var(--surface)); }

.lu-opts { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.lu-opts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
.lu-opt {
  display: flex; align-items: center; gap: 12px; text-align: left;
  background: var(--surface); border: none; border-radius: var(--r-md);
  padding: 11px 13px; cursor: pointer; font: inherit; transition: background 0.15s;
}
.lu-opt:hover:not(:disabled) { background: color-mix(in srgb, var(--accent) 13%, var(--surface)); }
.lu-opt:disabled { opacity: 0.4; cursor: default; }
.lu-opt.on { background: color-mix(in srgb, var(--accent) 20%, var(--surface)); box-shadow: inset 0 0 0 1px var(--accent); }
.lu-opt-slim { padding: 9px 13px; }
.lu-opt-mono {
  flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px;
  display: grid; place-items: center;
  font-family: var(--font-display); font-size: 19px; font-weight: 600; color: var(--accent);
  background: color-mix(in srgb, var(--accent) 15%, transparent);
}
.lu-opt-plus { font-family: inherit; font-weight: 700; }
.lu-opt-ghost { background: transparent; box-shadow: inset 0 0 0 1px var(--border-strong); }
.lu-opt-ghost:hover { box-shadow: inset 0 0 0 1px var(--accent); }
.lu-opt-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.lu-opt-name { font-size: 14px; font-weight: 600; color: var(--text-1); }
.lu-opt-sub { font-weight: 400; color: var(--text-2); }
.lu-opt-lvl { font-size: 11px; color: var(--text-muted); }

.lu-note {
  font-size: 12px; color: var(--text-2); line-height: 1.5;
  background: var(--surface); border-radius: var(--r-md);
  border-left: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  padding: 9px 12px; margin-top: 10px;
}
.lu-note-warn { border-left-color: var(--warning); }
.lu-note b { color: var(--text-1); }

.lu-sec { margin-top: 14px; display: flex; flex-direction: column; gap: 8px; }
.lu-sec-title { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--accent); }
.lu-req { font-size: 11px; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--warning); }
.lu-req.done { color: var(--success); }

.lu-feat { background: var(--surface); border-radius: var(--r-md); padding: 9px 12px; }
.lu-feat-head { display: flex; align-items: center; gap: 8px; }
.lu-feat-name { flex: 1; font-size: 13px; font-weight: 600; color: var(--text-1); }
.lu-feat-view {
  display: grid; place-items: center; width: 24px; height: 24px;
  border: none; border-radius: 6px; background: none; color: var(--text-muted); cursor: pointer;
}
.lu-feat-view:hover { color: var(--accent); background: color-mix(in srgb, var(--accent) 15%, transparent); }
.lu-feat-view svg { width: 15px; height: 15px; }
.lu-feat-desc { font-size: 12px; color: var(--text-muted); line-height: 1.45; margin-top: 3px; }
.lu-feat-choice-title { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: var(--text-2); margin-top: 8px; margin-bottom: 6px; }
.lu-spell-tag {
  display: inline-flex; align-items: center;
  background: color-mix(in srgb, var(--accent) 13%, var(--surface));
  border-radius: 999px; color: var(--text-1); font-size: 12px; font-weight: 500;
  padding: 6px 13px;
}

.lu-hp { display: flex; flex-direction: column; gap: 8px; }
.lu-hp-val { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.lu-hp-input { max-width: 90px; }
.lu-hp-n { font-size: 16px; font-weight: 700; color: var(--text-1); }
.lu-hp-total { font-size: 13px; font-weight: 600; color: var(--success); }
.lu-roll {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  border-radius: 8px; color: var(--text-1); font: inherit; font-size: 13px; font-weight: 600;
  padding: 7px 14px; cursor: pointer;
}
.lu-roll:hover { background: color-mix(in srgb, var(--accent) 28%, transparent); }
.lu-reroll { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 14px; }
.lu-reroll:hover { color: var(--accent); }

.lu-chips { display: flex; flex-wrap: wrap; gap: 7px; }
.lu-chip {
  background: var(--surface); border: none; border-radius: 999px;
  color: var(--text-2); font: inherit; font-size: 12px; font-weight: 600;
  padding: 7px 13px; cursor: pointer; transition: background 0.15s;
  font-variant-numeric: tabular-nums;
}
.lu-chip:hover { background: color-mix(in srgb, var(--accent) 14%, var(--surface)); }
.lu-chip.on { background: var(--accent); color: var(--text-on-accent); }
.lu-chip.off { opacity: 0.4; cursor: default; }
.lu-chip.off:hover { background: var(--surface); }
.lu-skip { align-self: flex-start; background: none; border: none; color: var(--text-muted); font: inherit; font-size: 12px; cursor: pointer; padding: 0; text-decoration: underline dotted; }
.lu-skip:hover { color: var(--text-2); }

.lu-list { margin: 0; padding-left: 18px; font-size: 13px; color: var(--text-2); display: flex; flex-direction: column; gap: 5px; }
.lu-list b { color: var(--text-1); font-variant-numeric: tabular-nums; }
.lu-slots-check { display: inline-flex; align-items: center; gap: 7px; cursor: pointer; }

.lu-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
.lu-btn {
  background: var(--accent); color: var(--text-on-accent); border: none; border-radius: 9px;
  padding: 9px 22px; font: inherit; font-weight: 600; cursor: pointer;
}
.lu-btn:disabled { opacity: 0.5; cursor: default; }
.lu-btn.ghost { background: transparent; color: var(--text-muted); box-shadow: inset 0 0 0 1px var(--border-strong); }
</style>
