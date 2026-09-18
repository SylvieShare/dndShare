<template>
  <div class="sdc-detail">
    <div v-if="showTitle" class="sdc-title-row">
      <ItemIcon v-if="item.iconImageUrl || item.svg" :item="item" :fallback-to-type="false" :size="38" />
      <div class="sdc-title-text">
        <div class="sdc-name">{{ item.name }}</div>
        <div v-if="item.nameEn" class="sdc-name-en">{{ nameEnFormatted }}</div>
      </div>
    </div>

    <div v-if="!summaryInHeader || data.concentration || data.ritual" class="sdc-pills">
      <span v-if="!summaryInHeader && lvlLabel" class="sdc-pill sdc-pill-lvl">{{ lvlLabel }}</span>
      <span v-if="!summaryInHeader && school" class="sdc-pill sdc-pill-school" :style="schoolStyle">{{ school }}</span>
      <span v-if="summaryInHeader && data.concentration" class="sdc-pill sdc-pill-conc">Концентрация</span>
      <span v-if="summaryInHeader && data.ritual" class="sdc-pill sdc-pill-ritual">Ритуал</span>
    </div>

    <SpellMetadata v-if="!summaryInHeader" :data="data" />
    <div v-if="materialComponent" class="sdc-comp-m"><strong>Материальный компонент:</strong> {{ materialComponent }}</div>

    <div v-if="classes.length" class="sdc-refs">
      <span class="sdc-ref-label">Доступно классам</span>
      <span class="sdc-classes">{{ classes.join(', ') }}</span>
    </div>

    <DetailSection label="Описание заклинания">
      <template #icon><ScrollText /></template>
      <RichContent v-if="data.description" class="sdc-desc" :html="data.description" />
      <div v-else class="sdc-no-desc">Описание отсутствует</div>
    </DetailSection>
  </div>
</template>

<script setup>
import SpellMetadata from '@/features/items/components/SpellMetadata.vue'
import { computed, ref, watch } from 'vue'
import { ScrollText } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import { DetailSection } from '@sylvieshare/share-ui'
import RichContent from '@/shared/ui/DndRichContent.vue'
import { useSchemaSuggests } from '@/features/handbook/objects/lib/useSchemaSuggests'
import { itemsApi } from '@/shared/api/itemsApi'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
  showTitle: { type: Boolean, default: true },
  summaryInHeader: { type: Boolean, default: false },
})

const { suggestItems } = useSchemaSuggests(() => props.type)

const data = computed(() => props.item.data || {})
const classNames = ref({})
const classIds = computed(() => (Array.isArray(data.value.classes) ? data.value.classes : []).map(ref => Number(ref?.id)).filter(Boolean))

watch(classIds, async ids => {
  if (!ids.length) { classNames.value = {}; return }
  const response = await itemsApi.byIds(ids).catch(() => null)
  classNames.value = Object.fromEntries((response?.items || []).map(item => [item.id, item.name]))
}, { immediate: true })

const lvlLabel = computed(() => {
  const lvl = data.value.lvl
  if (lvl === 0) return 'Заговор'
  if (lvl == null) return ''
  return lvl + ' уровень'
})

const schoolDetails = computed(() => suggestItems('schoolId').find(row => String(row.id) === String(data.value.schoolId)) || {})
const school = computed(() => schoolDetails.value.value || '')
const schoolStyle = computed(() => ({ '--school-color': schoolDetails.value.color || 'var(--text-2)' }))
const classes = computed(() => classIds.value.map(id => classNames.value[id]).filter(Boolean))
const materialComponent = computed(() => typeof data.value.components?.m === 'string' ? data.value.components.m : '')
const nameEnFormatted = computed(() =>
  (props.item.nameEn || '')
    .replace(/_/g, ' ')
    .replace(/\b[a-z]/g, ch => ch.toUpperCase())
)

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
.sdc-pill-school { background: color-mix(in srgb, var(--school-color) 13%, transparent); border: 1px solid color-mix(in srgb, var(--school-color) 42%, transparent); color: var(--school-color); }
.sdc-pill-conc   { background: color-mix(in srgb, var(--success) 15%, transparent);  color: var(--success); }
.sdc-pill-ritual { background: color-mix(in srgb, var(--warning) 13%, transparent);  color: var(--warning); }

.sdc-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: 24px;
  flex-wrap: wrap;
}

.sdc-title-text { min-width: 0; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }

.sdc-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.2;
}
.sdc-name-en { font-size: 13px; color: var(--text-muted); }

.sdc-comp-m { font-size: 12px; color: var(--text-muted); }

.sdc-refs { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.sdc-ref-label { flex: 0 0 auto; color: var(--text-muted); font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.sdc-classes { font-size: 12px; color: var(--text-muted); }

.sdc-desc {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.65;
  text-align: justify;
}

.sdc-no-desc { font-size: 13px; color: var(--text-muted); font-style: italic; }
</style>
