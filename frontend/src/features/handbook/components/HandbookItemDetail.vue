<template>
  <div class="detail-panel">
    <template v-if="item">

      <ItemDetailHeader v-if="showTitle" :item="item" :type="type">
        <template v-if="isEnemy" #summary>
          <EnemyDetailSummary :item="item" :type="type" />
        </template>
        <template v-if="isEnemy" #corner>
          <span
            v-if="enemySourceLabel"
            class="enemy-detail-source"
            :title="enemySourceTitle"
          >{{ enemySourceLabel }}</span>
        </template>
        <template #actions>
          <button v-if="canEdit" class="btn-edit" @click="$emit('edit', item)">Редактировать</button>
        </template>
      </ItemDetailHeader>

      <div v-if="item.contentSources?.length && type?.id !== 5" class="detail-sources">
        <span v-for="source in item.contentSources" :key="source.id" :title="source.name">{{ source.code || source.name }}</span>
      </div>

      <!-- Custom renderer (Weapon, Spell, Enemy…) -->
      <component
        v-if="customRenderer"
        :is="customRenderer"
        :item="item"
        :type="type"
        :show-title="false"
        :actor-name="actorName"
      />

      <!-- Generic schema-based view -->
      <template v-else>
        <template v-for="field in visibleFields" :key="field.key">
          <div class="field-label">{{ field.name }}</div>

          <template v-if="field.type === 'description'">
            <RichContent v-if="item.data[field.key]" class="field-desc" :html="item.data[field.key]" :actor-name="actorName" />
            <div v-else class="field-empty">—</div>
          </template>

          <template v-else-if="field.type === 'bool' || field.type === 'boolean'">
            <span class="field-bool" :class="{ 'field-bool-true': item.data[field.key] }">
              {{ item.data[field.key] ? '✓' : '✗' }}
            </span>
          </template>

          <template v-else-if="field.type === 'item'">
            <span class="field-text">{{ getItemRefLabel(item.data[field.key]) }}</span>
          </template>

          <template v-else-if="field.type === 'dice'">
            <SystemDie v-if="dieLabel(item.data[field.key])" :sides="item.data[field.key]" :size="42" />
            <span v-else class="field-empty">—</span>
          </template>

          <template v-else-if="field.type === 'suggest'">
            <span class="field-text">{{ getSuggestLabel(field, item.data[field.key]) || '—' }}</span>
          </template>

          <template v-else-if="field.type === 'suggest_array'">
            <span class="field-text">
              {{ ((item.data[field.key] || [])).map(id => getSuggestLabel(field, id)).filter(Boolean).join(', ') || '—' }}
            </span>
          </template>

          <template v-else-if="field.type === 'object'">
            <div class="field-object">
              <template v-for="sub in (field.fields || [])" :key="sub.key">
                <span class="field-sub-label">{{ sub.name }}</span>
                <span class="field-text">{{ formatSubValue(sub, (item.data[field.key] || {})[sub.key]) }}</span>
              </template>
            </div>
          </template>

          <template v-else-if="field.type === 'object_array'">
            <div v-if="(item.data[field.key] || []).length" class="field-object-array">
              <div v-for="(row, ri) in (item.data[field.key] || [])" :key="ri" class="field-object-row">
                <span v-for="sub in (field.fields || [])" :key="sub.key" class="field-object-cell">
                  <span class="field-sub-label">{{ sub.name }}</span>
                  <span class="field-text">{{ formatSubValue(sub, row[sub.key]) }}</span>
                </span>
              </div>
            </div>
            <div v-else class="field-empty">—</div>
          </template>

          <template v-else>
            <span class="field-text">{{ item.data[field.key] ?? '—' }}</span>
          </template>
        </template>
      </template>

      <!-- Edit button for custom renderers -->
      <div v-if="customRenderer && canEdit && !showTitle" class="detail-edit-row">
        <span class="detail-id">ID {{ item.id }}</span>
        <button class="btn-edit" @click="$emit('edit', item)">Редактировать</button>
      </div>

      <div v-if="showTitle" class="detail-technical-meta">
        <span>ID {{ item.id }}</span>
      </div>

    </template>
    <div v-else class="empty-hint">Выберите объект</div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import ItemDetailHeader from '@/features/handbook/components/ItemDetailHeader.vue'
import { useSuggestStore } from '@/stores/suggest'
import { ensureItemNames, itemName } from '@/features/handbook/objects/lib/itemNames'
import { getSuggestId, isFieldVisible } from '@/features/handbook/objects/lib/schemaFields'
import AbilityDetailContent from '@/features/items/detail-components/AbilityDetailContent'
import EnemyDetailContent from '@/features/items/detail-components/EnemyDetailContent'
import EnemyDetailSummary from '@/features/items/detail-components/EnemyDetailSummary.vue'
import FeatDetailContent from '@/features/items/detail-components/FeatDetailContent'
import ItemDetailContent from '@/features/items/detail-components/ItemDetailContent'
import PotionDetailContent from '@/features/items/detail-components/PotionDetailContent'
import SpellDetailContent from '@/features/items/detail-components/SpellDetailContent'
import WeaponDetailContent from '@/features/items/detail-components/WeaponDetailContent'
import RichContent from '@/shared/ui/DndRichContent.vue'
import SystemDie from '@/shared/ui/SystemDie.vue'
import { dieLabel } from '@/shared/lib/systemDice'

const CUSTOM_RENDERERS = {
  1: WeaponDetailContent,
  2: ItemDetailContent,
  3: AbilityDetailContent,
  4: AbilityDetailContent,
  5: SpellDetailContent,
  6: EnemyDetailContent,
  7: FeatDetailContent,
  10: PotionDetailContent,
}

const props = defineProps({
  item: { type: Object, default: null },
  type: { type: Object, default: null },
  canEdit: { type: Boolean, default: false },
  showTitle: { type: Boolean, default: true },
  actorName: { type: String, default: '' },
})

defineEmits(['edit'])

const customRenderer = computed(() => CUSTOM_RENDERERS[props.type?.id] || null)
const isEnemy = computed(() => props.type?.id === 6)
const enemySourceLabel = computed(() => {
  const sources = (props.item?.contentSources || [])
    .map(source => source.code || source.name)
    .filter(Boolean)
  const fallback = props.item?.data?.identity?.source
  const label = sources.length ? sources.join(', ') : fallback
  const page = props.item?.data?.identity?.source_page
  return label ? `${label}${page ? ` · СТР. ${page}` : ''}` : ''
})
const enemySourceTitle = computed(() => {
  const sources = (props.item?.contentSources || [])
    .map(source => source.name || source.code)
    .filter(Boolean)
  return sources.length ? sources.join(', ') : enemySourceLabel.value
})

const typeFields = computed(() => props.type?.fields || [])

const visibleFields = computed(() => {
  if (!props.item) return []
  return typeFields.value.filter(f => isFieldVisible(f, props.item.data || {}))
})

function collectItemRefIds(fields, data) {
  const ids = []
  for (const field of fields || []) {
    const value = data?.[field.key]
    if (field.type === 'item') {
      if (value != null) ids.push(value)
    } else if (field.type === 'object' && value) {
      ids.push(...collectItemRefIds(field.fields, value))
    } else if (field.type === 'object_array' && Array.isArray(value)) {
      for (const row of value) ids.push(...collectItemRefIds(field.fields, row))
    }
  }
  return ids
}

watch(
  () => props.item,
  (item) => {
    if (item) ensureItemNames(collectItemRefIds(typeFields.value, item.data || {}))
  },
  { immediate: true },
)

function getSuggests(field) {
  const sid = getSuggestId(field)
  return sid != null ? (useSuggestStore().items(sid) || []) : []
}

function getSuggestLabel(field, valueId) {
  if (valueId == null) return ''
  return getSuggests(field).find(s => s.id === valueId)?.value || String(valueId)
}

function getItemRefLabel(id) {
  if (id == null) return '—'
  return itemName(id) || ('#' + id)
}

function formatSubValue(sub, value) {
  if (value == null || value === '') return '—'
  if (sub.type === 'bool' || sub.type === 'boolean') return value ? '✓' : '✗'
  if (sub.type === 'suggest') return getSuggestLabel(sub, value) || '—'
  if (sub.type === 'dice') return dieLabel(value) || '—'
  if (sub.type === 'item') return getItemRefLabel(value)
  return String(value)
}
</script>

<style scoped>
.detail-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 16px 20px;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  background: var(--bg);
}

.empty-hint {
  color: var(--text-2);
  font-size: 14px;
  padding: 60px 0;
  text-align: center;
  margin: auto 0;
}

.detail-sources { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
.detail-sources span { border-radius: 999px; background: color-mix(in srgb, var(--accent) 12%, var(--surface)); color: var(--accent); padding: 3px 8px; font-size: 9px; font-weight: 700; letter-spacing: .04em; }

.detail-id { font-size: 11px; color: var(--text-muted); }

.enemy-detail-source {
  max-width: min(280px, 32vw);
  overflow: hidden;
  padding: 2px 7px;
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 18%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--surface) 68%, transparent);
  color: color-mix(in srgb, var(--text-on-accent) 62%, transparent);
  font-size: 11px;
  letter-spacing: .05em;
  text-overflow: ellipsis;
  text-shadow: 0 1px 7px var(--scrim);
  white-space: nowrap;
  backdrop-filter: blur(4px);
}

.detail-technical-meta {
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
  padding-top: 24px;
  color: var(--text-muted);
  font-size: 10px;
  letter-spacing: .04em;
}

.btn-edit {
  background: none;
  border: 1px dashed var(--border);
  color: var(--text-2);
  border-radius: 7px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.btn-edit:hover { color: var(--text-1); border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }

/* ── Schema fields ── */
.field-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--text-2);
  margin: 12px 0 5px;
}

.field-text { font-size: 13px; color: var(--text-1); }
.field-empty { font-size: 13px; color: var(--text-muted); }

.field-bool { font-size: 14px; color: var(--text-muted); }
.field-bool.field-bool-true { color: var(--success); }

.field-desc {
  font-size: 14px;
  color: var(--text-1);
  line-height: 1.65;
}

.field-object {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  align-items: center;
  padding: 8px 10px;
  background: color-mix(in srgb, var(--text-on-accent) 2%, transparent);
  border-radius: 8px;
  border: 1px solid var(--border);
}

.field-object-array {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-object-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  padding: 7px 9px;
  background: color-mix(in srgb, var(--text-on-accent) 2%, transparent);
  border-radius: 7px;
  border: 1px solid var(--border);
}

.field-object-cell {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
}

.field-sub-label {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

/* ── Edit row for custom renderers ── */
.detail-edit-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

@media (max-width: 760px) {
  .detail-panel {
    padding: 14px 16px;
  }

}

@media (max-width: 520px) {
  .detail-panel {
    padding: 12px;
  }

  .btn-edit {
    width: 100%;
  }
}
</style>
