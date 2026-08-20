<template>
  <div class="enemy-summary">
    <div v-if="alignmentTags.length" class="enemy-summary-meta">
      <div class="enemy-tags">
        <span v-for="tag in alignmentTags" :key="`${tag.key}:${tag.label}`" class="enemy-tag">{{ tag.label }}</span>
      </div>
    </div>

    <CoverSummaryLayout
      :side-min="132"
      :side-max="190"
      :center-min="220"
      :safe-min-height="190"
      :medium-side-min="116"
      :medium-side-max="150"
      :medium-center-min="100"
    >
      <template #left>
        <div v-if="identity.named_npc || detailTags.length" class="enemy-tags enemy-tags-left">
          <span v-if="identity.named_npc" class="enemy-tag enemy-tag-named">Именной</span>
          <span v-for="tag in detailTags" :key="`${tag.key}:${tag.label}`" class="enemy-tag">{{ tag.label }}</span>
        </div>
        <CoverStatCard
          :icon="Gauge"
          label="Уровень опасности"
          :value="combat.cr ?? '—'"
          :note="combat.xp != null ? `${formatXp(combat.xp)} опыта` : ''"
          tone="danger"
        />
        <CoverStatCard :icon="Shield" label="Класс доспеха" :value="combat.ac ?? '—'" :note="combat.ac_note" />
      </template>

      <template #right>
        <CoverStatCard :icon="Heart" label="Хиты" :value="combat.hp ?? '—'" :note="combat.hp_formula" />
        <CoverStatCard
          v-if="combat.proficiencyBonus != null"
          :icon="Sparkles"
          label="Бонус мастерства"
          :value="formatBonus(combat.proficiencyBonus)"
        />
        <template v-if="combat.speed_opt?.length">
          <CoverStatCard
            v-for="speed in combat.speed_opt"
            :key="speed.name || '__base'"
            :icon="speedIcon(speed.name)"
            :label="speedLabel(speed.name)"
            :value="speed.value"
            note="фт."
            size="medium"
          />
        </template>
        <CoverStatCard
          v-else-if="combat.speed"
          :icon="Footprints"
          label="Пешком"
          :value="combat.speed"
          size="medium"
        />
      </template>

      <template #bottom>
        <div class="enemy-abilities">
          <div v-for="ability in abilities" :key="ability.key" class="enemy-ability">
            <div class="ab-label">{{ ability.label }}</div>
            <div class="ab-mod" :class="modClass(stats[ability.key])">{{ abilityMod(stats[ability.key]) }}</div>
            <div class="ab-score">{{ stats[ability.key] ?? '—' }}</div>
            <div v-if="saves[ability.key] != null" class="ab-save">
              СПАС {{ formatBonus(saves[ability.key]) }}
            </div>
          </div>
        </div>
      </template>
    </CoverSummaryLayout>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { Bird, Footprints, Gauge, Heart, Mountain, Shield, Sparkles, Waves } from '@lucide/vue'
import CoverStatCard from '@/features/items/components/cover/CoverStatCard.vue'
import CoverSummaryLayout from '@/features/items/components/cover/CoverSummaryLayout.vue'
import { abilityModifier, formatBonus as signedBonus } from '@/shared/lib/dnd'
import { SAVE_ABBR } from '@/shared/lib/dndStats'
import { getSuggestId } from '@/features/handbook/objects/lib/schemaFields'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})

const suggestStore = useSuggestStore()

function walkFields(fields, data) {
  const out = []
  for (const field of fields || []) {
    const value = data?.[field.key]
    out.push({ field, value })
    if (field.type === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
      out.push(...walkFields(field.fields, value))
    }
  }
  return out
}

watch(
  () => [props.type, props.item?.data],
  () => {
    const buckets = new Map()
    for (const { field, value } of walkFields(props.type?.fields || [], props.item?.data || {})) {
      if (!field.tag || (field.type !== 'suggest' && field.type !== 'suggest_array')) continue
      const typeId = getSuggestId(field)
      if (typeId == null) continue
      const ids = (Array.isArray(value) ? value : [value]).filter(id => id != null && id !== '')
      if (!ids.length) continue
      const bucket = buckets.get(typeId) || new Set()
      ids.forEach(id => bucket.add(Number(id)))
      buckets.set(typeId, bucket)
    }
    for (const [typeId, ids] of buckets) suggestStore.ensureItems(typeId, [...ids])
  },
  { immediate: true, deep: true },
)

const abilities = Object.entries(SAVE_ABBR).map(([key, label]) => ({ key, label }))
const identity = computed(() => props.item.data?.identity || {})
const combat = computed(() => props.item.data?.combat || {})
const stats = computed(() => props.item.data?.stats || {})
const saves = computed(() => props.item.data?.saving_throws || {})

const tagRows = computed(() => {
  const result = []
  for (const { field, value } of walkFields(props.type?.fields || [], props.item?.data || {})) {
    if (!field.tag || value == null || value === '' || value === false) continue
    if (field.type === 'bool' || field.type === 'boolean') {
      result.push({ key: field.key, label: field.name.toUpperCase() })
    } else if (field.type === 'suggest' || field.type === 'suggest_array') {
      const typeId = getSuggestId(field)
      const ids = Array.isArray(value) ? value : [value]
      const labels = typeId == null
        ? ids.map(String)
        : ids.map(id => suggestStore.items(typeId)?.find(suggest => suggest.id === id)?.value).filter(Boolean)
      if (labels.length) result.push({ key: field.key, label: labels.join(', ').toUpperCase() })
    } else {
      result.push({ key: field.key, label: String(value).toUpperCase() })
    }
  }
  return result
})
const alignmentTags = computed(() => tagRows.value.filter(tag => tag.key === 'alignment'))
const detailTags = computed(() => tagRows.value.filter(tag => tag.key !== 'alignment'))

function formatBonus(value) {
  return value == null ? '' : signedBonus(value)
}

function speedLabel(name) {
  if (!name) return 'Пешком'
  const labels = { 'летая': 'Полёт', 'плавая': 'Плавание', 'лазая': 'Лазание', 'роя': 'Роющий ход' }
  return labels[name.toLowerCase()] ?? name
}

function speedIcon(name) {
  const value = String(name || '').toLowerCase()
  if (value.includes('лет')) return Bird
  if (value.includes('плав')) return Waves
  if (value.includes('лаз') || value.includes('ро')) return Mountain
  return Footprints
}

function abilityMod(score) {
  if (score == null) return '—'
  const modifier = abilityModifier(score)
  return modifier >= 0 ? `+${modifier}` : `${modifier}`
}

function modClass(score) {
  if (score == null) return ''
  const modifier = abilityModifier(score)
  if (modifier >= 2) return 'mod-pos'
  if (modifier < 0) return 'mod-neg'
  return ''
}

function formatXp(xp) {
  return xp?.toLocaleString('ru-RU') ?? ''
}
</script>

<style scoped src="./styles/EnemyDetailSummary.css"></style>
