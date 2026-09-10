<template>
  <div class="origin-detail">
    <DetailSection v-if="description" label="Обзор">
      <template #icon><BookOpen /></template>
      <RichContent class="origin-description" :html="description" />
    </DetailSection>

    <ClassProgression
      v-if="progressionClass"
      :class-item="progressionClass"
      :subclasses="kind === 'class' ? relationItems : []"
      :fixed-subclass="kind === 'subclass' ? item : null"
      @open-item="viewItem = $event"
    />

    <DetailSection v-if="relationItems.length || relationLoading" :label="relationTitle">
      <template #icon><GitBranch /></template>
      <LoadingState v-if="relationLoading" class="origin-loading" label="Загрузка связей…" compact />
      <div v-else class="origin-relations">
        <button
          v-for="related in relationItems"
          :key="related.id"
          type="button"
          class="origin-relation-card"
          @click="viewItem = related"
        >
          <span class="origin-relation-media" :class="{ 'origin-relation-media--emblem': kind.includes('class') }">
            <ItemIcon v-if="kind.includes('class') && (related.iconImageUrl || related.svg)" :item="related" :size="64" :fallback-to-type="false" />
            <img v-else-if="!kind.includes('class') && (related.coverImageUrl || related.iconImageUrl)" :src="related.coverImageUrl || related.iconImageUrl" alt="" aria-hidden="true" />
            <span v-else>{{ monogram(related.name) }}</span>
          </span>
          <span class="origin-relation-copy">
            <small>{{ relationItemLabel }}</small>
            <strong>{{ related.name }}</strong>
            <span>{{ plainOriginDescription(related, 110) || 'Открыть запись справочника' }}</span>
          </span>
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </DetailSection>

    <DetailSection v-if="mechanics.length" label="Правила и характеристики">
      <template #icon><ListChecks /></template>
      <div class="origin-fact-grid">
        <div v-for="fact in mechanics" :key="fact.label" class="origin-fact" :class="{ 'origin-fact--wide': fact.wide }">
          <small>{{ fact.label }}</small>
          <strong>{{ fact.value }}</strong>
        </div>
      </div>
    </DetailSection>

    <DetailSection v-if="proficiencyGroups.length" label="Владения">
      <template #icon><ShieldCheck /></template>
      <div class="origin-proficiencies">
        <div v-for="group in proficiencyGroups" :key="group.label" class="origin-proficiency-group">
          <small>{{ group.label }}</small>
          <div><span v-for="value in group.values" :key="value">{{ value }}</span></div>
        </div>
      </div>
    </DetailSection>

    <DetailSection v-if="spellcastingNote" label="Заклинательство">
      <template #icon><WandSparkles /></template>
      <RichContent class="origin-description" :html="spellcastingNote" />
    </DetailSection>

    <DetailSection v-if="grantedSpells.length" label="Дарованные заклинания">
      <template #icon><Sparkles /></template>
      <div class="origin-spells">
        <button v-for="entry in grantedSpells" :key="`${entry.item.id}:${entry.level}:${entry.option || ''}`" type="button" @click="viewItem = entry.item">
          <span>{{ entry.item.name }}</span>
          <small>с {{ entry.level }} ур.<template v-if="entry.option"> · {{ entry.option }}</template></small>
        </button>
      </div>
    </DetailSection>

    <DetailSection v-if="data.starting_equipment" label="Стартовое снаряжение">
      <template #icon><Backpack /></template>
      <RichContent class="origin-description" :html="data.starting_equipment" />
    </DetailSection>

    <ItemViewModal
      v-if="viewItem"
      :item="viewItem.data ? viewItem : null"
      :item-id="viewItem.id"
      :item-type-id="viewItem.typeId"
      @close="viewItem = null"
    />
  </div>
</template>

<script setup>
import { LoadingState } from '@sylvieshare/share-ui'
import { computed, ref, watch } from 'vue'
import { Backpack, BookOpen, ChevronRight, GitBranch, ListChecks, ShieldCheck, Sparkles, WandSparkles } from '@lucide/vue'
import DetailSection from '@/shared/ui/DetailSection.vue'
import ClassProgression from './ClassProgression.vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import RichContent from '@/shared/ui/DndRichContent.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import { itemsApi } from '@/shared/api/itemsApi'
import { useSuggestStore } from '@/stores/suggest'
import { SUBCLASS_ITEM_TYPE, SUBRACE_ITEM_TYPE } from '@/shared/lib/dndItemTypes'
import {
  abilityNames,
  asiLabel,
  hitDieLabel,
  originKind,
  originRelationIds,
  plainOriginDescription,
  spellcastingLabel,
  subclassSpellcastingLabel,
} from '@/features/items/lib/originPresentation'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
  summaryInHeader: { type: Boolean, default: false },
})
const suggestStore = useSuggestStore()
;[3, 4, 5, 6, 15].forEach(id => suggestStore.ensure(id))

const data = computed(() => props.item.data || {})
const kind = computed(() => originKind(props.type?.id || props.item.typeId))
const description = computed(() => data.value.description || data.value.short_description || '')
const relationIds = computed(() => originRelationIds(props.item))
const loadedItems = ref([])
const relationLoading = ref(false)
const viewItem = ref(null)
let requestId = 0

const byId = computed(() => new Map(loadedItems.value.map(item => [String(item.id), item])))
const relationItems = computed(() => {
  if (kind.value === 'race') return loadedItems.value.filter(item => Number(item.typeId) === SUBRACE_ITEM_TYPE)
  if (kind.value === 'class') return loadedItems.value.filter(item => Number(item.typeId) === SUBCLASS_ITEM_TYPE)
  return relationIds.value.map(id => byId.value.get(String(id))).filter(Boolean)
})
const relationTitle = computed(() => ({
  race: 'Подрасы и наследия',
  subrace: 'Базовая раса',
  class: 'Подклассы и архетипы',
  subclass: 'Базовый класс',
})[kind.value] || 'Связанные записи')
const progressionClass = computed(() => kind.value === 'class' ? props.item
  : kind.value === 'subclass' ? relationItems.value.find(item => Number(item.typeId) === 9) : null)
const relationItemLabel = computed(() => ({ race: 'подраса', subrace: 'раса', class: 'подкласс', subclass: 'класс' })[kind.value] || 'связь')
const suggestLabels = (typeId, ids) => (Array.isArray(ids) ? ids : [])
  .map(id => suggestStore.items(typeId).find(item => String(item.id) === String(id))?.value)
  .filter(Boolean)

const mechanics = computed(() => {
  const result = []
  const add = (label, value, wide = false) => value && result.push({ label, value, wide })
  if (kind.value.includes('race')) {
    add('Бонусы характеристик', asiLabel(data.value, { short: false }), true)
    add('Размер', data.value.size)
    add('Скорость', data.value.speed != null ? `${data.value.speed} фт.` : '')
    add('Языки', suggestLabels(6, data.value.languages).join(', '), true)
    if (data.value.skill_choice?.count) add('Выбор навыков', `${data.value.skill_choice.count}`)
    if (data.value.lang_choice?.count) add('Выбор языков', `${data.value.lang_choice.count}`)
  } else {
    add('Кость хитов', hitDieLabel(data.value))
    add('Ключевые характеристики', abilityNames(data.value.primary_abilities).join(', '), true)
    add('Спасброски', abilityNames(data.value.saves).join(', '), true)
    add('Заклинательство', kind.value === 'subclass' ? subclassSpellcastingLabel(data.value) : spellcastingLabel(data.value))
    add('Выбор подкласса', data.value.subclass_level ? `${data.value.subclass_level} уровень` : '')
    add('Уровни ASI', data.value.asi_levels)
  }
  if (!props.summaryInHeader) return result
  // Keep only details that are not already shown in the cover summary/roadmap.
  const uniqueLabels = kind.value === 'subrace'
    ? ['Бонусы характеристик', 'Выбор навыков', 'Выбор языков']
    : ['Выбор навыков', 'Выбор языков']
  return result.filter(fact => uniqueLabels.includes(fact.label))
})
const proficiencyGroups = computed(() => [
  { label: 'Доспехи', values: suggestLabels(3, data.value.armor_prof) },
  { label: 'Оружие', values: suggestLabels(4, data.value.weapon_prof) },
  { label: 'Инструменты', values: suggestLabels(5, data.value.tool_prof) },
  { label: 'Навыки', values: suggestLabels(15, data.value.skill_prof) },
].filter(group => group.values.length))
const spellcastingNote = computed(() => data.value.spellcasting?.note || '')
const grantedSpells = computed(() => (Array.isArray(data.value.granted_spells) ? data.value.granted_spells : [])
  .map(row => ({
    item: byId.value.get(String(row?.spell?.id ?? row?.spell)),
    level: Number(row?.level) || 1,
    option: row?.option || '',
  }))
  .filter(entry => entry.item))

watch(
  () => props.item,
  async item => {
    const current = ++requestId
    const currentKind = originKind(props.type?.id || item?.typeId)
    const spellIds = (Array.isArray(item?.data?.granted_spells) ? item.data.granted_spells : [])
      .map(row => Number(row?.spell?.id ?? row?.spell))
      .filter(Number.isFinite)
    const relationIds = originRelationIds(item)
    const relationRequest = currentKind === 'race'
      ? itemsApi.listAll(SUBRACE_ITEM_TYPE, {}, { race: [item.id] })
      : currentKind === 'class'
        ? itemsApi.listAll(SUBCLASS_ITEM_TYPE, {}, { class: [item.id] })
        : relationIds.length ? itemsApi.byIds(relationIds) : Promise.resolve({ items: [] })
    const spellRequest = spellIds.length ? itemsApi.byIds([...new Set(spellIds)]) : Promise.resolve({ items: [] })
    if (!relationIds.length && !spellIds.length && currentKind !== 'race' && currentKind !== 'class') {
      loadedItems.value = []
      return
    }
    relationLoading.value = true
    try {
      const [relations, spells] = await Promise.all([relationRequest, spellRequest])
      if (current === requestId) {
        loadedItems.value = [...new Map([...(relations?.items || []), ...(spells?.items || [])]
          .map(loaded => [String(loaded.id), loaded])).values()]
      }
    } catch {
      if (current === requestId) loadedItems.value = []
    } finally {
      if (current === requestId) relationLoading.value = false
    }
  },
  { immediate: true },
)

function monogram(name) { return String(name || '?').trim().slice(0, 1).toLocaleUpperCase('ru') }
</script>

<style scoped>
.origin-detail { display: flex; flex-direction: column; padding-bottom: 14px; }
.origin-description { padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--r-md); background: color-mix(in srgb, var(--surface) 82%, transparent); color: var(--text-2); font-size: 13px; line-height: 1.7; }
.origin-loading { padding: 18px; color: var(--text-muted); font-size: 12px; }
.origin-relations { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
.origin-relation-card { min-width: 0; min-height: 94px; display: grid; grid-template-columns: 86px minmax(0, 1fr) 18px; align-items: center; gap: 11px; padding: 7px 10px 7px 7px; border: 1px solid var(--border); border-radius: 12px; background: color-mix(in srgb, var(--surface) 88%, transparent); color: var(--text-1); font: inherit; text-align: left; cursor: pointer; transition: border-color .15s, background .15s, transform .15s; }
.origin-relation-card:hover { border-color: color-mix(in srgb, var(--accent) 52%, var(--border)); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); transform: translateY(-1px); }
.origin-relation-card > svg { width: 17px; color: var(--text-muted); }
.origin-relation-media { width: 86px; height: 78px; display: grid; place-items: center; overflow: hidden; border-radius: 9px; background: color-mix(in srgb, var(--accent) 12%, var(--bg)); color: var(--accent-soft); font-family: var(--font-display); font-size: 28px; font-weight: 700; }
.origin-relation-media img { width: 100%; height: 100%; object-fit: cover; }
.origin-relation-media--emblem { background: transparent; }
.origin-relation-copy { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.origin-relation-copy small { color: var(--accent-soft); font-size: 8px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
.origin-relation-copy strong { overflow: hidden; color: var(--text-1); font-family: var(--font-display); font-size: 16px; text-overflow: ellipsis; white-space: nowrap; }
.origin-relation-copy > span { display: -webkit-box; overflow: hidden; color: var(--text-muted); font-size: 10px; line-height: 1.4; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.origin-fact-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.origin-fact { min-width: 0; padding: 11px 12px; border: 1px solid var(--border); border-radius: 10px; background: color-mix(in srgb, var(--surface) 72%, transparent); }
.origin-fact--wide { grid-column: span 2; }
.origin-fact small { display: block; margin-bottom: 4px; color: var(--text-muted); font-size: 8px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
.origin-fact strong { color: var(--text-1); font-size: 13px; line-height: 1.35; overflow-wrap: anywhere; }
.origin-proficiencies { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
.origin-proficiency-group { padding: 11px 12px; border-left: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); border-radius: 0 9px 9px 0; background: color-mix(in srgb, var(--surface) 70%, transparent); }
.origin-proficiency-group small { display: block; margin-bottom: 6px; color: var(--text-muted); font-size: 9px; font-weight: 750; text-transform: uppercase; }
.origin-proficiency-group div { display: flex; flex-wrap: wrap; gap: 5px; }
.origin-proficiency-group span { padding: 3px 7px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--text-2); font-size: 10px; }
.origin-spells { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.origin-spells button { min-width: 0; display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 9px 11px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--text-1); font: inherit; text-align: left; cursor: pointer; }
.origin-spells button:hover { border-color: color-mix(in srgb, var(--accent) 52%, var(--border)); }
.origin-spells span { overflow: hidden; font-size: 12px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.origin-spells small { flex: none; color: var(--text-muted); font-size: 9px; }
@media (max-width: 760px) { .origin-relations, .origin-proficiencies, .origin-spells { grid-template-columns: 1fr; } .origin-fact-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 480px) { .origin-fact-grid { grid-template-columns: 1fr; } .origin-fact--wide { grid-column: auto; } .origin-relation-card { grid-template-columns: 74px minmax(0, 1fr) 16px; } .origin-relation-media { width: 74px; height: 70px; } }
</style>
