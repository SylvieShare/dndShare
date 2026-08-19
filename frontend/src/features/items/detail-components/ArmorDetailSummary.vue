<template>
  <div class="armor-summary">
    <div class="armor-summary-grid">
      <div class="armor-summary-side armor-summary-left">
        <div class="armor-stat armor-stat-primary">
          <span class="armor-stat-label"><ShieldCheck :size="13" aria-hidden="true" /> Класс доспеха</span>
          <strong>{{ armorValue }}</strong>
          <span>{{ armorNote }}</span>
        </div>
        <div class="armor-stat">
          <span class="armor-stat-label"><Layers3 :size="13" aria-hidden="true" /> Категория</span>
          <strong class="armor-stat-compact">{{ categoryLabel }}</strong>
        </div>
      </div>

      <div class="armor-cover-safe-zone" aria-hidden="true"></div>

      <div class="armor-summary-side armor-summary-right">
        <div v-if="costLabel" class="armor-stat">
          <span class="armor-stat-label"><Coins :size="13" aria-hidden="true" /> Стоимость</span>
          <strong class="armor-stat-compact">{{ costLabel }}</strong>
        </div>
        <div v-if="data.weight != null" class="armor-stat">
          <span class="armor-stat-label"><Weight :size="13" aria-hidden="true" /> Вес</span>
          <strong>{{ data.weight }}</strong>
          <span>фунт.</span>
        </div>
      </div>

      <div class="armor-requirements">
        <div class="armor-requirement">
          <BadgeCheck :size="15" aria-hidden="true" />
          <span><small>Владение</small>{{ proficiencyLabel }}</span>
        </div>
        <div class="armor-requirement">
          <Dumbbell :size="15" aria-hidden="true" />
          <span><small>Сила</small>{{ strengthLabel }}</span>
        </div>
        <div class="armor-requirement">
          <EyeOff :size="15" aria-hidden="true" />
          <span><small>Скрытность</small>{{ stealthLabel }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { BadgeCheck, Coins, Dumbbell, EyeOff, Layers3, ShieldCheck, Weight } from '@lucide/vue'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  item: { type: Object, required: true },
})

const CATEGORY_LABELS = {
  light: 'Лёгкий',
  medium: 'Средний',
  heavy: 'Тяжёлый',
  shield: 'Щит',
}

const suggestStore = useSuggestStore()
suggestStore.ensure(3)

const data = computed(() => props.item.data || {})
const armor = computed(() => data.value.armor || {})
const { format: formatCost } = useCostFormatter()
const costLabel = computed(() => formatCost(data.value.cost))
const categoryLabel = computed(() => CATEGORY_LABELS[data.value.category] || 'Доспех')
const proficiencyLabel = computed(() => {
  const id = data.value.required_armor_proficiency
  return suggestStore.items(3).find(row => row.id === id)?.value || 'Не указано'
})
const armorValue = computed(() => armor.value.shield ? `+${armor.value.shield_bonus ?? 2}` : (armor.value.ac ?? '—'))
const armorNote = computed(() => {
  if (armor.value.shield) return 'бонус к КД'
  if (!armor.value.use_dex) return 'без Ловкости'
  if (armor.value.dex_cap != null) return `+ ЛОВ, максимум +${armor.value.dex_cap}`
  return '+ модификатор ЛОВ'
})
const strengthLabel = computed(() => data.value.strength_required != null ? `${data.value.strength_required}+` : 'Без требования')
const stealthLabel = computed(() => data.value.stealth_disadvantage ? 'Помеха' : 'Без помехи')
</script>

<style scoped src="./styles/ArmorDetailSummary.css"></style>
