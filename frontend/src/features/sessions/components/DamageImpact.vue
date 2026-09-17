<template>
  <div class="damage-impact">
    <SaveTargetName v-if="showTarget" :target="impact.target" :icon-size="36" />
    <div class="impact-summary">
      <HeartPulse :size="19" />
      <strong :class="impact.total < 0 ? 'impact-healing' : 'impact-damage'">{{ amountLabel }}</strong>
      <span class="impact-hp">{{ impact.before.current }} <ArrowRight :size="14" /> <b>{{ impact.after.current }}</b><span v-if="impact.after.max"> / {{ impact.after.max }}</span></span>
      <span v-if="impact.absorbed" class="impact-temp"><Shield :size="14" /> Поглощено {{ impact.absorbed }}</span>
    </div>
    <DamageImpactBar :impact="impact" />
    <div v-if="impact.damage?.length" class="impact-parts">
      <span v-for="(part, i) in impact.damage" :key="i" :style="{ color: part.color || 'var(--text-2)' }">{{ part.label || 'Урон' }}: <b>{{ part.applied }}</b><small v-if="part.defense"> · {{ defenseLabels[part.defense] }}</small></span>
    </div>
    <ApplicationSummary v-if="impact.effects?.length" :data="impact" result />
    <span v-if="impact.effectsRemoved?.length" class="impact-removed">Сняты эффекты: {{ impact.effectsRemoved.map(id => effectItems.get(String(id))?.name || `#${id}`).join(', ') }}</span>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { ArrowRight, HeartPulse, Shield } from '@lucide/vue'
import DamageImpactBar from './DamageImpactBar.vue'
import SaveTargetName from './SaveTargetName.vue'
import ApplicationSummary from '@/features/character-editor/components/ApplicationSummary.vue'
import { useItemReferenceMap } from '@/features/items/composables/useItemReferenceMap'
const props = defineProps({ impact: { type: Object, required: true }, showTarget: { type: Boolean, default: true } })
const { itemsById: effectItems } = useItemReferenceMap(computed(() => props.impact.effectsRemoved || []))
const amountLabel = computed(() => props.impact.total < 0 ? `+${-props.impact.total} хитов` : props.impact.total ? `Урон ${props.impact.total}` : props.impact.effects?.length ? 'Эффект применён' : props.impact.effectsRemoved?.length ? 'Эффект снят' : 'Без урона')
const defenseLabels = { immunity: 'иммунитет', resistance: 'сопротивление', vulnerability: 'уязвимость', resistance_vulnerability: 'сопротивление и уязвимость' }
</script>
<style scoped>
.damage-impact { display: grid; gap: 8px; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface); font-size: 13px; min-width: 0; }
.impact-summary, .impact-hp, .impact-temp, .impact-parts { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.impact-summary > svg, .impact-damage { color: var(--danger); }.impact-healing { color: var(--success); }
.impact-hp { margin-left: auto; font-variant-numeric: tabular-nums; }.impact-hp b { font-size: 18px; }
.impact-temp { color: var(--info); font-size: 12px; }
.impact-parts { gap: 6px 12px; font-size: 12px; }.impact-parts small, .impact-removed { color: var(--text-muted); }
</style>
