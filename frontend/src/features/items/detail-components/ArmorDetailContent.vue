<template>
  <div class="armor-detail-content">
    <DetailSection v-if="data.desc" label="Описание">
      <RichContent class="armor-description" :html="data.desc" :actor-name="actorName || item.name" />
    </DetailSection>

    <DetailSection label="Правила ношения">
      <div class="armor-rules">
        <div class="armor-rule">
          <span>Владение</span>
          <strong>{{ proficiencyLabel }}</strong>
          <small>Без владения проверки характеристик, спасброски и атаки с СИЛ или ЛОВ совершаются с помехой, а заклинания недоступны.</small>
        </div>
        <div class="armor-rule">
          <span>Расчёт КД</span>
          <strong>{{ acRule }}</strong>
          <small>{{ dexRule }}</small>
        </div>
        <div class="armor-rule">
          <span>Ограничения</span>
          <strong>{{ restrictionTitle }}</strong>
          <small>{{ restrictionText }}</small>
        </div>
      </div>
    </DetailSection>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import DetailSection from '@/shared/ui/DetailSection.vue'
import RichContent from '@/shared/ui/DndRichContent.vue'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  item: { type: Object, required: true },
  actorName: { type: String, default: '' },
})

const suggestStore = useSuggestStore()
suggestStore.ensure(3)

const data = computed(() => props.item.data || {})
const armor = computed(() => data.value.armor || {})
const proficiencyLabel = computed(() => {
  const id = data.value.required_armor_proficiency
  return suggestStore.items(3).find(row => row.id === id)?.value || 'Не указано'
})
const acRule = computed(() => armor.value.shield
  ? `+${armor.value.shield_bonus ?? 2} к КД`
  : `КД ${armor.value.ac ?? '—'}`)
const dexRule = computed(() => {
  if (armor.value.shield) return 'Бонус щита складывается с надетым доспехом.'
  if (!armor.value.use_dex) return 'Модификатор Ловкости не добавляется.'
  if (armor.value.dex_cap != null) return `Добавляется модификатор Ловкости, но не более +${armor.value.dex_cap}.`
  return 'Добавляется полный модификатор Ловкости.'
})
const restrictionTitle = computed(() => {
  const parts = []
  if (data.value.strength_required != null) parts.push(`СИЛ ${data.value.strength_required}`)
  if (data.value.stealth_disadvantage) parts.push('Помеха Скрытности')
  return parts.join(' · ') || 'Нет'
})
const restrictionText = computed(() => {
  if (data.value.strength_required != null && data.value.stealth_disadvantage) {
    return 'Недостаток Силы снижает скорость на 10 фт.; проверки Скрытности совершаются с помехой.'
  }
  if (data.value.strength_required != null) return 'Недостаток Силы снижает скорость на 10 фт.'
  if (data.value.stealth_disadvantage) return 'Проверки Скрытности совершаются с помехой.'
  return 'Дополнительных ограничений нет.'
})
</script>

<style scoped>
.armor-detail-content { display: flex; flex-direction: column; gap: 18px; }
.armor-description { color: var(--text-1); font-size: 14px; line-height: 1.65; }
.armor-rules { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.armor-rule {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 13px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}
.armor-rule > span { color: var(--text-muted); font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
.armor-rule > strong { color: var(--text-1); font-size: 15px; line-height: 1.25; }
.armor-rule > small { color: var(--text-2); font-size: 11px; line-height: 1.45; }
@media (max-width: 760px) { .armor-rules { grid-template-columns: 1fr; } }
</style>
