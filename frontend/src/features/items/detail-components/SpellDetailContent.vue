<template>
  <div class="sdc-detail">
    <div class="sdc-title-row">
      <div class="sdc-name">{{ item.name }}</div>
      <div v-if="item.nameEn" class="sdc-name-en">{{ nameEnFormatted }}</div>
    </div>

    <div class="sdc-pills">
      <span v-if="lvlLabel" class="sdc-pill sdc-pill-lvl">{{ lvlLabel }}</span>
      <span v-if="school" class="sdc-pill sdc-pill-school" :style="schoolStyle">{{ school }}</span>
      <span v-if="data.concentration" class="sdc-pill sdc-pill-conc">Концентрация</span>
      <span v-if="data.ritual" class="sdc-pill sdc-pill-ritual">Ритуал</span>
    </div>

    <div v-if="data.time || data.range || data.duration" class="sdc-meta-row">
      <div v-if="data.time" class="sdc-meta-cell">
        <img class="sdc-meta-icon" :src="iconUrls.time" alt="" aria-hidden="true" />
        <span class="sdc-meta-val">{{ data.time }}</span>
        <span class="sdc-meta-lbl">Время</span>
      </div>
      <div v-if="data.range" class="sdc-meta-cell">
        <img class="sdc-meta-icon" :src="iconUrls.range" alt="" aria-hidden="true" />
        <span class="sdc-meta-val">{{ data.range }}</span>
        <span class="sdc-meta-lbl">Дистанция</span>
      </div>
      <div v-if="data.duration" class="sdc-meta-cell">
        <img class="sdc-meta-icon" :src="iconUrls.duration" alt="" aria-hidden="true" />
        <span class="sdc-meta-val">{{ data.duration }}</span>
        <span class="sdc-meta-lbl">Длительность</span>
      </div>
    </div>

    <div v-if="hasComponents" class="sdc-comp-row">
      <span class="sdc-comp-lbl">Компоненты:</span>
      <span v-if="data.components?.v" class="sdc-comp">В</span>
      <span v-if="data.components?.s" class="sdc-comp">С</span>
      <span v-if="data.components?.m" class="sdc-comp">М</span>
      <span v-if="data.components?.m && typeof data.components.m === 'string'" class="sdc-comp-m">
        ({{ data.components.m }})
      </span>
    </div>

    <div v-if="source || classes.length" class="sdc-refs">
      <span v-if="source" class="sdc-source">{{ source }}</span>
      <span v-if="classes.length" class="sdc-classes">{{ classes.join(', ') }}</span>
    </div>

    <div class="sdc-divider"></div>

    <RichContent v-if="data.description" class="sdc-desc" :html="data.description" />
    <div v-else class="sdc-no-desc">Описание отсутствует</div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import RichContent from '@/shared/ui/RichContent'
import { useSchemaSuggests } from '@/features/handbook/objects/lib/useSchemaSuggests'
import { itemsApi } from '@/shared/api/itemsApi'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})

const { suggestItems } = useSchemaSuggests(() => props.type)

const schoolDetailsMap = computed(() => Object.fromEntries(suggestItems('schoolId').map(s => [s.id, s])))
const schoolMap = computed(() => Object.fromEntries(suggestItems('schoolId').map(s => [s.id, s.value])))
const data = computed(() => props.item.data || {})
const classNames = ref({})
const classIds = computed(() => (Array.isArray(data.value.classes) ? data.value.classes : []).map(ref => Number(ref?.id)).filter(Boolean))

watch(classIds, async ids => {
  if (!ids.length) { classNames.value = {}; return }
  const response = await itemsApi.byIds(ids).catch(() => null)
  classNames.value = Object.fromEntries((response?.items || []).map(item => [item.id, item.name]))
}, { immediate: true })

const iconUrls = computed(() => {
  const base = import.meta.env.BASE_URL || '/'
  return {
    time: `${base}static/spell-time.svg`,
    range: `${base}static/spell-range.svg`,
    duration: `${base}static/spell-duration.svg`,
  }
})

const lvlLabel = computed(() => {
  const lvl = data.value.lvl
  if (lvl === 0) return 'Заговор'
  if (lvl == null) return ''
  return lvl + ' уровень'
})

const school = computed(() => schoolMap.value[data.value.schoolId] || '')
const schoolDetails = computed(() => schoolDetailsMap.value[data.value.schoolId] || {})
const schoolColor = computed(() => normalizeColor(schoolDetails.value.color))
const schoolStyle = computed(() => {
  if (!schoolColor.value) return {}
  return {
    borderColor: colorAlpha(schoolColor.value, 0.42),
    backgroundColor: colorAlpha(schoolColor.value, 0.13),
    color: schoolColor.value,
  }
})
const source = computed(() => (props.item.contentSources || []).map((entry) => entry.name || entry.code).filter(Boolean).join(', '))
const classes = computed(() => classIds.value.map(id => classNames.value[id]).filter(Boolean))
const hasComponents = computed(() => {
  const c = data.value.components
  return c && (c.v || c.s || c.m)
})
const nameEnFormatted = computed(() =>
  (props.item.nameEn || '')
    .replace(/_/g, ' ')
    .replace(/\b[a-z]/g, ch => ch.toUpperCase())
)

function normalizeColor(color) {
  const value = String(color || '').trim()
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value)) return value
  if (/^rgb(a)?\(/i.test(value)) return value
  return ''
}

function colorAlpha(color, alpha) {
  if (!color || color.startsWith('rgb')) return color
  const hex = color.length === 4
    ? color.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3')
    : color
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
</script>

<style scoped>
.sdc-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sdc-pills { display: flex; flex-wrap: wrap; gap: 6px; }

.sdc-pill {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 5px;
}

.sdc-pill-lvl    { background: color-mix(in srgb, var(--accent-soft) 15%, transparent); color: var(--accent-soft); }
.sdc-pill-school { background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); border: 1px solid transparent; color: var(--text-2); }
.sdc-pill-conc   { background: color-mix(in srgb, var(--success) 15%, transparent);  color: var(--success); }
.sdc-pill-ritual { background: color-mix(in srgb, var(--warning) 13%, transparent);  color: var(--warning); }

.sdc-title-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding-right: 24px;
  flex-wrap: wrap;
}

.sdc-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.2;
}
.sdc-name-en { font-size: 13px; color: var(--text-muted); }

.sdc-divider { height: 1px; background: var(--border); }

.sdc-meta-row {
  display: flex;
  border-radius: 10px;
  overflow: hidden;
  background: color-mix(in srgb, var(--text-on-accent) 3%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 6%, transparent);
}
.sdc-meta-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 8px;
  border-right: 1px solid color-mix(in srgb, var(--text-on-accent) 6%, transparent);
}
.sdc-meta-cell:last-child { border-right: none; }
.sdc-meta-icon {
  width: 18px;
  height: 18px;
  display: block;
  flex-shrink: 0;
}
.sdc-meta-val  { font-size: 12px; font-weight: 600; color: var(--text-1); text-align: center; }
.sdc-meta-lbl  { font-size: 10px; color: var(--text-muted); letter-spacing: 0.06em; text-transform: uppercase; }

.sdc-comp-row { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.sdc-comp-lbl { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.sdc-comp {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-2);
  background: color-mix(in srgb, var(--text-on-accent) 6%, transparent);
  border-radius: 4px;
  padding: 2px 7px;
}
.sdc-comp-m { font-size: 11px; color: var(--text-muted); font-style: italic; }

.sdc-refs { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.sdc-source {
  font-size: 11px;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  border-radius: 4px;
  padding: 2px 8px;
}
.sdc-classes { font-size: 12px; color: var(--text-muted); }

.sdc-desc {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.65;
  text-align: justify;
}

.sdc-no-desc { font-size: 13px; color: var(--text-muted); font-style: italic; }
</style>
