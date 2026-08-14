<template>
  <div
    class="ecr-result"
    :class="{
      'ecr-result--critical': result.roll === 20,
      'ecr-result--fumble': result.roll === 1,
    }"
    :aria-label="ariaLabel"
  >
    <span class="ecr-kind">{{ ability.short }} · {{ challenge.savingThrow ? 'спасбросок' : 'проверка' }}</span>
    <span class="ecr-roll">{{ result.roll }} {{ formattedBonus }}</span>
    <strong>{{ result.total }}</strong>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatBonus } from '@/shared/lib/dnd'

const props = defineProps({
  challenge: { type: Object, required: true },
  ability: { type: Object, required: true },
  result: { type: Object, required: true },
})

const formattedBonus = computed(() => formatBonus(props.result.bonus))
const ariaLabel = computed(() => {
  const kind = props.challenge.savingThrow ? 'спасбросок' : 'проверка'
  return `${props.ability.label}, ${kind}: ${props.result.roll} ${formattedBonus.value}, итог ${props.result.total}`
})
</script>

<style scoped>
.ecr-result {
  display: grid;
  min-height: 28px;
  box-sizing: border-box;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 4px 8px 4px 10px;
  border: 1px solid color-mix(in srgb, var(--accent) 34%, var(--border));
  border-radius: 7px;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.ecr-kind {
  overflow: hidden;
  color: var(--text-2);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.055em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.ecr-roll {
  color: var(--text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.ecr-result strong {
  min-width: 30px;
  color: var(--accent-soft);
  font-size: 17px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.ecr-result--critical {
  border-color: color-mix(in srgb, var(--success) 50%, var(--border));
  background: color-mix(in srgb, var(--success) 10%, transparent);
}

.ecr-result--critical strong { color: var(--success); }

.ecr-result--fumble {
  border-color: color-mix(in srgb, var(--danger) 48%, var(--border));
  background: color-mix(in srgb, var(--danger) 9%, transparent);
}

.ecr-result--fumble strong { color: var(--danger); }
</style>
