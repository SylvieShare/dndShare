<template>
  <div class="enemy-detail">
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
import { findField, getSuggestId } from '@/features/handbook/objects/lib/schemaFields'
import DetailSection from '@/shared/ui/DetailSection.vue'
import RichContent from '@/shared/ui/DndRichContent.vue'
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

const identity = computed(() => props.item.data?.identity || {})

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

</script>

<style scoped src="./styles/EnemyDetailContent.css"></style>
