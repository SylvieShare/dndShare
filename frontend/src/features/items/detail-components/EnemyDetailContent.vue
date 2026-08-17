<template>
  <div class="enemy-detail">

    <!-- ── Top block with right-anchored background image ── -->
    <div class="enemy-top">

      <!-- Background: image or type svg -->
      <img v-if="item.iconImageUrl" :src="item.iconImageUrl" class="enemy-top-img" alt="" />
      <SvgIcon
        v-else-if="item.svg || (type && type.svg)"
        class="enemy-top-svg"
        :svg="item.svg || type.svg"
        :color="item.svg ? null : type.color"
        :size="140"
      />

      <!-- Gradient fade so content stays readable -->
      <div class="enemy-top-fade"></div>

      <!-- Foreground content -->
      <div class="enemy-top-content">
        <!-- Tags -->
        <div v-if="identity.named_npc || tags.length" class="enemy-tags">
          <span v-if="identity.named_npc" class="enemy-tag enemy-tag-named">Именной</span>
          <span v-for="tag in tags" :key="tag" class="enemy-tag">{{ tag }}</span>
        </div>

        <!-- Name -->
        <h1 v-if="showTitle" class="enemy-title">{{ item.name }}</h1>

        <!-- Source badge -->
        <div v-if="identity.source" class="enemy-source">
          {{ identity.source }}<template v-if="identity.source_page"> · СТР. {{ identity.source_page }}</template>
        </div>

        <!-- Stats + abilities block (same width) -->
        <div class="enemy-stats-block">
          <div class="enemy-stats-row">
            <div class="enemy-stat-card enemy-stat-cr">
              <div class="stat-label" title="Уровень опасности помогает мастеру подобрать существо подходящей сложности для группы.">
                <Gauge class="stat-icon" aria-hidden="true" /> Уровень опасности
              </div>
              <div class="stat-value">{{ combat.cr ?? '—' }}</div>
              <div v-if="combat.xp != null" class="stat-note">{{ formatXp(combat.xp) }} опыта</div>
            </div>
            <div class="enemy-stat-card">
              <div class="stat-label" title="Класс доспеха — сложность попадания по существу"><Shield class="stat-icon" aria-hidden="true" /> Класс доспеха</div>
              <div class="stat-value">{{ combat.ac ?? '—' }}</div>
              <div v-if="combat.ac_note" class="stat-note">{{ combat.ac_note }}</div>
            </div>
            <div class="enemy-stat-card">
              <div class="stat-label" title="Хиты — запас здоровья существа"><Heart class="stat-icon" aria-hidden="true" /> Хиты</div>
              <div class="stat-value">{{ combat.hp ?? '—' }}</div>
              <div v-if="combat.hp_formula" class="stat-note">{{ combat.hp_formula }}</div>
            </div>
            <div v-if="combat.proficiencyBonus != null" class="enemy-stat-card">
              <div class="stat-label" title="Бонус мастерства"><Sparkles class="stat-icon" aria-hidden="true" /> Бонус мастерства</div>
              <div class="stat-value">{{ formatBonus(combat.proficiencyBonus) }}</div>
            </div>
          </div>

          <div class="enemy-speed-row">
            <template v-if="combat.speed_opt?.length">
              <div v-for="s in combat.speed_opt" :key="s.name || '__base'" class="enemy-stat-card enemy-stat-speed">
                <div class="stat-label"><component :is="speedIcon(s.name)" class="stat-icon" aria-hidden="true" /> {{ speedLabel(s.name) }}</div>
                <div class="stat-value speed-value">{{ s.value }}</div>
                <div class="stat-note">фт.</div>
              </div>
            </template>
            <div v-else-if="combat.speed" class="enemy-stat-card enemy-stat-speed">
              <div class="stat-label"><Footprints class="stat-icon" aria-hidden="true" /> Пешком</div>
              <div class="stat-value speed-value">{{ combat.speed }}</div>
            </div>
          </div>

          <div class="enemy-abilities">
            <div v-for="ab in abilities" :key="ab.key" class="enemy-ability">
              <div class="ab-label">{{ ab.label }}</div>
              <div class="ab-mod" :class="modClass(stats[ab.key])">{{ abilityMod(stats[ab.key]) }}</div>
              <div class="ab-score">{{ stats[ab.key] ?? '—' }}</div>
              <div v-if="saves[ab.key] != null" class="ab-save">
                СПАС {{ formatBonus(saves[ab.key]) }}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Info list -->
    <div v-if="infoRows.length" class="enemy-info-list">
      <div v-for="row in infoRows" :key="row.label" class="enemy-info-row">
        <div class="info-label">{{ row.label }}</div>
        <div class="info-value">{{ row.value }}</div>
      </div>
    </div>

    <!-- Environment -->
    <DetailSection v-if="environmentLabels.length" label="Среда обитания">
      <div class="enemy-chips">
        <span v-for="label in environmentLabels" :key="label" class="enemy-chip">{{ label }}</span>
      </div>
    </DetailSection>

    <!-- Feats -->
    <DetailSection v-if="item.data.feats?.length" label="Особенности">
      <div class="enemy-blocks">
        <div v-for="b in item.data.feats" :key="b.name" class="enemy-block-tile">
          <div class="block-name">{{ b.name }}</div>
          <RichContent class="block-text" :html="b.value" :actor-name="actorName || item.name" />
        </div>
      </div>
    </DetailSection>

    <!-- Actions -->
    <DetailSection v-if="item.data.actions?.length" label="Действия">
      <div class="enemy-blocks">
        <div v-for="b in item.data.actions" :key="b.name" class="enemy-block-tile">
          <div class="block-name">{{ b.name }}</div>
          <RichContent class="block-text" :html="b.value" :actor-name="actorName || item.name" />
        </div>
      </div>
    </DetailSection>

    <!-- Reactions -->
    <DetailSection v-if="item.data.reactions?.length" label="Реакции">
      <div class="enemy-blocks">
        <div v-for="b in item.data.reactions" :key="b.name" class="enemy-block-tile">
          <div class="block-name">{{ b.name }}</div>
          <RichContent class="block-text" :html="b.value" :actor-name="actorName || item.name" />
        </div>
      </div>
    </DetailSection>

    <!-- Description (under collapsible, since it can be very long) -->
    <DetailSection
      v-if="item.data.description"
      label="Описание"
      collapsible
      :default-open="false"
    >
      <RichContent class="enemy-desc" :html="item.data.description" :actor-name="actorName || item.name" />
    </DetailSection>

    <!-- Tags as accordion (at the very bottom) -->
    <DetailSection v-if="tagSuggests.length" label="Теги">
      <div class="enemy-tag-list">
        <div v-for="s in tagSuggests" :key="s.id" class="enemy-tag-card" :class="{ active: expandedTag === s.id }">
          <button
            class="enemy-tag-head"
            :class="{ 'has-desc': !!s.desc }"
            type="button"
            @click="s.desc && (expandedTag = expandedTag === s.id ? null : s.id)"
          >
            <span class="enemy-tag-name">{{ s.value }}</span>
            <svg v-if="s.desc" class="enemy-tag-chevron" viewBox="0 0 16 16" fill="none" width="14" height="14">
              <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <RichContent v-if="s.desc && expandedTag === s.id" class="enemy-tag-body" :html="s.desc" :actor-name="actorName || item.name" />
        </div>
      </div>
    </DetailSection>

  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Bird, Footprints, Gauge, Heart, Mountain, Shield, Sparkles, Waves } from '@lucide/vue'
import { abilityModifier, formatBonus as signedBonus } from '@/shared/lib/dnd'
import { SAVE_ABBR } from '@/shared/lib/dndStats'
import { findField, getSuggestId } from '@/features/handbook/objects/lib/schemaFields'
import DetailSection from '@/shared/ui/DetailSection.vue'
import RichContent from '@/shared/ui/DndRichContent.vue'
import SvgIcon from '@/shared/ui/SvgIcon'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
  showTitle: { type: Boolean, default: true },
  actorName: { type: String, default: '' },
})

const suggestStore = useSuggestStore()

function walkFields(fields, data) {
  const out = []
  for (const f of fields || []) {
    const v = data?.[f.key]
    out.push({ field: f, value: v, parentData: data })
    if (f.type === 'object' && v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...walkFields(f.fields, v))
    }
  }
  return out
}

watch(
  () => [props.type, props.item?.data],
  () => {
    const fields = props.type?.fields || []
    const data = props.item?.data || {}
    const buckets = new Map()
    const collect = (typeId, ids) => {
      if (typeId == null) return
      const arr = Array.isArray(ids) ? ids : [ids]
      const cleaned = arr.filter(v => v != null && v !== '')
      if (!cleaned.length) return
      const cur = buckets.get(typeId) || new Set()
      cleaned.forEach(v => cur.add(Number(v)))
      buckets.set(typeId, cur)
    }
    for (const { field, value } of walkFields(fields, data)) {
      if (field.type !== 'suggest' && field.type !== 'suggest_array') continue
      collect(getSuggestId(field), value)
    }
    for (const [typeId, ids] of buckets) {
      suggestStore.ensureItems(typeId, [...ids])
    }
  },
  { immediate: true, deep: true },
)

const abilities = Object.entries(SAVE_ABBR).map(([key, label]) => ({ key, label }))

const identity = computed(() => props.item.data?.identity || {})
const combat = computed(() => props.item.data?.combat || {})
const stats = computed(() => props.item.data?.stats || {})
const saves = computed(() => props.item.data?.saving_throws || {})

const tags = computed(() => {
  const fields = props.type?.fields || []
  const data = props.item?.data || {}
  const result = []
  for (const { field, value } of walkFields(fields, data)) {
    if (!field.tag) continue
    const val = value
    if (val == null || val === '' || val === false) continue
    if (field.type === 'bool' || field.type === 'boolean') {
      result.push(field.name.toUpperCase())
    } else if (field.type === 'suggest') {
      const sid = getSuggestId(field)
      const label = sid != null ? suggestStore.items(sid)?.find(s => s.id === val)?.value : null
      result.push((label || String(val)).toUpperCase())
    } else if (field.type === 'suggest_array') {
      const sid = getSuggestId(field)
      const ids = Array.isArray(val) ? val : [val]
      const labels = sid != null
        ? ids.map(id => suggestStore.items(sid)?.find(s => s.id === id)?.value).filter(Boolean)
        : ids.map(String)
      if (labels.length) result.push(labels.join(', ').toUpperCase())
    } else {
      result.push(String(val).toUpperCase())
    }
  }
  return result
})

const expandedTag = ref(null)
watch(() => props.item?.id, () => { expandedTag.value = null })

const tagSuggests = computed(() => {
  const fields = props.type?.fields || []
  const field = findField(fields, 'tags')
  const val = props.item.data?.tags
  if (!field || !Array.isArray(val) || !val.length) return []
  const sid = getSuggestId(field)
  if (sid == null) return []
  return val.map(id => suggestStore.items(sid)?.find(s => s.id === id)).filter(Boolean)
})

const infoRows = computed(() => {
  const d = props.item.data || {}
  const rows = [
    { label: 'НАВЫКИ', value: d.skills },
    { label: 'ЧУВСТВА', value: d.senses },
    { label: 'ЯЗЫКИ', value: d.languages },
    { label: 'СОПР. К УРОНУ', value: d.damage_resistances },
    { label: 'ИММУН. К УРОНУ', value: d.damage_immunities },
    { label: 'ИММУН. К СОСТОЯНИЯМ', value: d.condition_immunities },
  ]
  return rows.filter(r => r.value)
})

const environmentLabels = computed(() => {
  const fields = props.type?.fields || []
  const field = findField(fields, 'environment')
  const val = identity.value.environment
  if (!field || !Array.isArray(val) || !val.length) return []
  const sid = getSuggestId(field)
  if (sid == null) return val.map(String)
  return val.map(id => suggestStore.items(sid)?.find(s => s.id === id)?.value).filter(Boolean)
})

function formatBonus(n) {
  return n == null ? '' : signedBonus(n)
}

function speedLabel(name) {
  if (!name) return 'Пешком'
  const map = { 'летая': 'Полёт', 'плавая': 'Плавание', 'лазая': 'Лазание', 'роя': 'Роющий ход' }
  return map[name.toLowerCase()] ?? name
}

function speedIcon(name) {
  const value = String(name || '').toLowerCase()
  if (value.includes('лет')) return Bird
  if (value.includes('плав')) return Waves
  if (value.includes('лаз')) return Mountain
  if (value.includes('ро')) return Mountain
  return Footprints
}

function abilityMod(score) {
  if (score == null) return '—'
  const mod = abilityModifier(score)
  return mod >= 0 ? `+${mod}` : `${mod}`
}

function modClass(score) {
  if (score == null) return ''
  const mod = abilityModifier(score)
  if (mod >= 2) return 'mod-pos'
  if (mod < 0) return 'mod-neg'
  return ''
}

function formatXp(xp) {
  return xp?.toLocaleString('ru-RU') ?? ''
}
</script>

<style scoped src="./styles/EnemyDetailContent.css"></style>
