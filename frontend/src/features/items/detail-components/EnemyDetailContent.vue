<template>
  <div class="enemy-detail">

    <!-- ── Top block with right-anchored background image ── -->
    <div class="enemy-top">

      <!-- Background: image or type svg -->
      <img v-if="item.data.image_url" :src="item.data.image_url" class="enemy-top-img" alt="" />
      <SvgIcon
        v-else-if="type && type.svg"
        class="enemy-top-svg"
        :svg="type.svg"
        :color="type.color"
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
        <h1 class="enemy-title">{{ item.name }}</h1>

        <!-- Source badge -->
        <div v-if="identity.source" class="enemy-source">
          {{ identity.source }}<template v-if="identity.source_page"> · СТР. {{ identity.source_page }}</template>
        </div>

        <!-- Stats + abilities block (same width) -->
        <div class="enemy-stats-block">
          <div class="enemy-stats-row">
            <div class="enemy-stat-card enemy-stat-cr">
              <div class="stat-label">CR</div>
              <div class="stat-value">{{ combat.cr ?? '—' }}</div>
              <div v-if="combat.xp != null" class="stat-note">{{ formatXp(combat.xp) }} XP</div>
            </div>
            <div class="enemy-stat-card">
              <div class="stat-label">КД</div>
              <div class="stat-value">{{ combat.ac ?? '—' }}</div>
              <div v-if="combat.ac_note" class="stat-note">{{ combat.ac_note }}</div>
            </div>
            <div class="enemy-stat-card">
              <div class="stat-label">ХИТ</div>
              <div class="stat-value">{{ combat.hp ?? '—' }}</div>
              <div v-if="combat.hp_formula" class="stat-note">{{ combat.hp_formula }}</div>
            </div>
            <div v-if="combat.proficiencyBonus != null" class="enemy-stat-card">
              <div class="stat-label">БМ</div>
              <div class="stat-value">{{ formatBonus(combat.proficiencyBonus) }}</div>
            </div>
          </div>

          <div class="enemy-speed-row">
            <template v-if="combat.speed_opt?.length">
              <div v-for="s in combat.speed_opt" :key="s.name || '__base'" class="enemy-stat-card enemy-stat-speed">
                <div class="stat-label">{{ speedLabel(s.name) }}</div>
                <div class="stat-value speed-value">{{ s.value }}</div>
                <div class="stat-note">фт.</div>
              </div>
            </template>
            <div v-else-if="combat.speed" class="enemy-stat-card enemy-stat-speed">
              <div class="stat-label">СКР</div>
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
          <RichContent class="block-text" :html="b.value" />
        </div>
      </div>
    </DetailSection>

    <!-- Actions -->
    <DetailSection v-if="item.data.actions?.length" label="Действия">
      <div class="enemy-blocks">
        <div v-for="b in item.data.actions" :key="b.name" class="enemy-block-tile">
          <div class="block-name">{{ b.name }}</div>
          <RichContent class="block-text" :html="b.value" />
        </div>
      </div>
    </DetailSection>

    <!-- Reactions -->
    <DetailSection v-if="item.data.reactions?.length" label="Реакции">
      <div class="enemy-blocks">
        <div v-for="b in item.data.reactions" :key="b.name" class="enemy-block-tile">
          <div class="block-name">{{ b.name }}</div>
          <RichContent class="block-text" :html="b.value" />
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
      <RichContent class="enemy-desc" :html="item.data.description" />
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
          <RichContent v-if="s.desc && expandedTag === s.id" class="enemy-tag-body" :html="s.desc" />
        </div>
      </div>
    </DetailSection>

  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { abilityModifier, formatBonus as signedBonus } from '@/shared/lib/dnd'
import { SAVE_ABBR } from '@/shared/lib/dndStats'
import { findField, getSuggestId } from '@/features/handbook/objects/lib/schemaFields'
import DetailSection from '@/shared/ui/DetailSection.vue'
import RichContent from '@/shared/ui/RichContent'
import SvgIcon from '@/shared/ui/SvgIcon'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
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
  if (!name) return 'ХОД'
  const map = { 'летая': 'ЛЁТА', 'плавая': 'ПЛАВ', 'лазая': 'ЛАЗА', 'роя': 'РОЙ' }
  return map[name.toLowerCase()] ?? name.slice(0, 4).toUpperCase()
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

<style scoped>
.enemy-detail {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ── Top block ── */
.enemy-top {
  position: relative;
  margin: -16px -20px 0;
  overflow: hidden;
}

/* Background image: anchored to right, fills block height */
.enemy-top-img {
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  width: auto;
  max-width: 65%;
  object-fit: cover;
  object-position: left center;
}

/* Fallback SVG: large, right-side, decorative */
.enemy-top-svg {
  position: absolute;
  right: 24px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.07;
  pointer-events: none;
}

/* Gradient: solid on left (content readable), fades right (image shows) + bottom fade */
.enemy-top-fade {
  position: absolute;
  inset: 0;
}

.enemy-top-content {
  position: relative;
  z-index: 1;
  padding: 20px 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ── Tags ── */
.enemy-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.enemy-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-2);
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 10%, transparent);
  border-radius: 4px;
  padding: 2px 7px;
}

.enemy-tag-named {
  color: var(--text-2);
  background: color-mix(in srgb, var(--text-2) 12%, transparent);
  border-color: color-mix(in srgb, var(--text-2) 40%, transparent);
}

/* ── Name ── */
.enemy-title {
  margin: 8px 0 0;
  font-family: var(--font-display);
  font-size: 36px;
  font-weight: 600;
  color: var(--text-1);
  line-height: 1.1;
}

.enemy-source {
  margin-top: 3px;
  font-size: 11px;
  color: color-mix(in srgb, var(--text-on-accent) 40%, transparent);
  letter-spacing: 0.05em;
}

/* ── Stats + abilities wrapper ── */
.enemy-stats-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
  align-self: flex-start;
}

/* ── Main stat cards ── */
.enemy-stats-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.enemy-speed-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.enemy-stat-speed { min-width: 70px; }

.enemy-stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.enemy-stat-cr {
  border-color: color-mix(in srgb, var(--danger) 45%, transparent);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
}
.enemy-stat-cr .stat-label { color: color-mix(in srgb, var(--danger) 65%, transparent); }
.enemy-stat-cr .stat-value { color: var(--danger); }

.stat-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.stat-value {
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  font-size: 27px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1;
  margin-top: 2px;
}

.speed-value {
  font-size: 20px;
  line-height: 1.2;
}

.stat-note {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
  line-height: 1.3;
}

/* ── Ability scores ── */
.enemy-abilities {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 4px;
}

.enemy-ability {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.ab-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.09em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.ab-mod {
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  font-size: 25px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1;
}
.ab-mod.mod-pos { color: var(--success); }
.ab-mod.mod-neg { color: var(--danger); }

.ab-score {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1;
}

.ab-save {
  margin-top: 4px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--accent, var(--accent-soft));
  background: color-mix(in srgb, var(--accent-soft) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-soft) 30%, transparent);
  border-radius: 4px;
  padding: 1px 5px;
  line-height: 1.2;
}

/* ── Info list (vertical) ── */
.enemy-info-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
  padding: 12px 14px;
  background: color-mix(in srgb, var(--text-on-accent) 2.5%, transparent);
  border-radius: 8px;
  border: 1px solid var(--border);
  font-size: 13px;
}

.enemy-info-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.info-value {
  color: var(--text-1);
  line-height: 1.45;
}

/* ── Chips (environment) ── */
.enemy-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.enemy-chip {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--text-2);
  background: color-mix(in srgb, var(--text-on-accent) 5%, transparent);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 3px 10px;
}

/* ── Tags accordion (bottom) ── */
.enemy-tag-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.enemy-tag-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--text-on-accent) 2.5%, transparent);
  overflow: hidden;
  transition: border-color 0.15s, background 0.15s;
}
.enemy-tag-card.active {
  border-color: color-mix(in srgb, var(--accent-soft) 35%, transparent);
  background: color-mix(in srgb, var(--accent-soft) 6%, transparent);
}

.enemy-tag-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  background: none;
  border: none;
  font-family: inherit;
  color: var(--text-1);
  text-align: left;
  cursor: default;
}
.enemy-tag-head.has-desc { cursor: pointer; }
.enemy-tag-head.has-desc:hover { background: color-mix(in srgb, var(--text-on-accent) 4%, transparent); }

.enemy-tag-name {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
  line-height: 1.2;
}

.enemy-tag-chevron {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: transform 0.2s;
}
.enemy-tag-card.active .enemy-tag-chevron {
  transform: rotate(180deg);
  color: var(--accent, var(--accent-soft));
}

.enemy-tag-body {
  padding: 0 16px 14px;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.65;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

/* ── Blocks (feats / actions / reactions) ── */
.enemy-blocks {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.enemy-block-tile {
  background: color-mix(in srgb, var(--text-on-accent) 2.5%, transparent);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
}

.block-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
  margin-bottom: 4px;
}

.block-text {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.6;
}

/* ── Description ── */
.enemy-desc {
  font-size: 14px;
  color: var(--text-1);
  line-height: 1.7;
}

/* ── Responsive ── */
@media (max-width: 760px) {
  .enemy-top { margin: -14px -16px 0; }
  .enemy-title { font-size: 24px; }
  .enemy-abilities { grid-template-columns: repeat(3, 1fr); }
}

@media (max-width: 520px) {
  .enemy-top { margin: -12px -12px 0; }
  .enemy-title { font-size: 22px; }
  .enemy-abilities { grid-template-columns: repeat(3, 1fr); }
  .stat-value { font-size: 24px; }
  .ab-mod { font-size: 22px; }
}
</style>
