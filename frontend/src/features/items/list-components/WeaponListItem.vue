<template>
  <div class="wli">
    <SvgIcon
      v-if="type && type.svg"
      class="wli-icon"
      :svg="type.svg"
      :color="type.color"
    />
    <span v-else class="wli-icon-placeholder" aria-hidden="true"></span>

    <div class="wli-main">
      <div class="wli-name-row">
        <span class="wli-name">{{ item.name }}</span>
        <span v-if="item.nameEn" class="wli-name-en">{{ nameEnFormatted }}</span>
        <span v-if="item.userId != null" class="wli-custom" title="Ваш объект">✦</span>
      </div>
      <div v-if="subtitle" class="wli-sub">{{ subtitle }}</div>
    </div>

    <div class="wli-right">
      <span v-if="damage" class="wli-damage">
        <template v-if="damage.iconUrl">
          <span v-if="damage.count !== 1" class="wli-count">{{ damage.count }}</span>
          <span class="wli-dice" v-html="damage.iconUrl" aria-hidden="true"></span>
        </template>
        <template v-else>{{ damage.label }}</template>
      </span>
      <svg class="wli-chevron" viewBox="0 0 16 16" fill="none" width="14" height="14">
        <path d="M6 12L10 8L6 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SvgIcon from '@/shared/ui/SvgIcon'
import { findField, getSuggestId } from '@/features/handbook/objects/lib/schemaFields'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})

const suggestStore = useSuggestStore()

function suggestItems(fieldKey) {
  const sid = getSuggestId(findField(props.type?.fields, fieldKey))
  return sid != null ? suggestStore.items(sid) : []
}

const diceDetailsMap = computed(() => Object.fromEntries(suggestItems('dice_id').map(s => [s.id, s])))
const damageTypeMap = computed(() => Object.fromEntries(suggestItems('type').map(s => [s.id, s.value])))
const tagMap = computed(() => Object.fromEntries(suggestItems('tags').map(s => [s.id, s.value])))

const data = computed(() => props.item.data || {})
const firstAttack = computed(() => Array.isArray(data.value.attacks) ? data.value.attacks[0] : null)

const damage = computed(() => attackDamage(firstAttack.value))
const damageType = computed(() => firstAttack.value
  ? (damageTypeMap.value[firstAttack.value.type] || firstAttack.value.type || '')
  : '')

const tagLabels = computed(() =>
  (Array.isArray(data.value.tags) ? data.value.tags : [])
    .map(id => tagMap.value[id] || String(id))
    .filter(Boolean)
)

const subtitle = computed(() => {
  const parts = [damageType.value, ...tagLabels.value].filter(Boolean)
  return parts.join(' · ')
})

const nameEnFormatted = computed(() =>
  (props.item.nameEn || '')
    .replace(/_/g, ' ')
    .replace(/\b[a-z]/g, ch => ch.toUpperCase())
)

function attackDamage(attack) {
  if (!attack) return null
  const count = Number(attack.count) || 1
  const dice = diceDetailsMap.value[attack.dice_id] || null
  const diceLabel = dice?.value || ''
  if (!diceLabel) return { count, diceLabel: '', iconUrl: '', label: String(count) }
  return { count, diceLabel, iconUrl: dice?.svg || '', label: `${count}${diceLabel}` }
}
</script>

<style scoped>
.wli {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.wli-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
}

.wli-icon-placeholder {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--border);
}

.wli-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.wli-name-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.wli-name {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 600;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.wli-name-en {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
}

.wli-custom {
  color: var(--accent);
  font-size: 8px;
  flex-shrink: 0;
}

.wli-sub {
  font-size: 11px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wli-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.wli-damage {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px 2px 4px;
  border: 1px solid rgba(162,146,255,0.18);
  border-radius: 6px;
  background: rgba(162,146,255,0.09);
  color: #d0d0dc;
  font-size: 11px;
  font-weight: 700;
}

.wli-count { min-width: 8px; text-align: right; }

.wli-dice {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wli-dice :deep(svg) { width: 22px; height: 22px; }

.wli-chevron {
  color: var(--text-muted);
  flex-shrink: 0;
}
</style>
